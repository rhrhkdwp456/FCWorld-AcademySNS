const express = require('express');
const router = require('express').Router()
const ObjectId = require('mongodb').ObjectId;
const multer = require("multer");
const path = require("path");
const fs = require('fs').promises;

// DB연결
let connectDB = require('./../database.js')

let db;
connectDB.then((client)=>{
    db = client.db('forum')
}).catch((err)=>{
  console.log(err)
})

// 저장 폴더와 파일명 설정
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads'); // 이미지가 저장될 디렉토리
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname)); // 고유한 파일명 생성
    }
});


// 파일 필터링 (예: 이미지 파일만 허용)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
  };

// Multer 미들웨어 설정
const upload = multer({ storage: storage, fileFilter: fileFilter });



// // multer 기본 라이브러리 셋팅
// const { S3Client } = require('@aws-sdk/client-s3')
// const multer = require('multer')
// const multerS3 = require('multer-s3')
// const s3 = new S3Client({
//   region : 'ap-northeast-2',
//   credentials : {
//       accessKeyId : process.env.S3_KEY,
//       secretAccessKey : process.env.S3_SECRET,
//   }
// })

// const upload = multer({
//   storage: multerS3({
//     s3: s3,
//     bucket: 'paulteacherforum1',
//     key: function (요청, file, cb) {
//       cb(null, Date.now().toString()) //업로드시 파일명 변경가능
//     }
//   })
// })

function checkLogin(요청, 응답, next){
    if(요청.user && 요청.user.authority == "FC"){
        next()
    } else if(요청.user && 요청.user.authority == "MANAGER"){
        next()
    }else {
        응답.render('login.ejs')
    }
}

router.use(checkLogin)
router.get('/post/list', async(요청, 응답)=>{
    if(요청.user.authority == "MANAGER" || 요청.user.authority == "FC"){
        let userid = 요청.user._id
        let result = await db.collection('post').find().toArray()
        if(result == ''){
            응답.render('post-write.ejs')
        }
        else{
            응답.render('post-list.ejs', { posts : result , userid : userid })
        }
    }else{
        응답.redirect('/home')
    }
       
})

router.get('/post/write', async(요청, 응답)=>{
        응답.render('post-write.ejs')
})


// 라우트 설정
// 라우트 설정
// router.post('/post/add', upload.single('image'), (req, res) => {
//     try {
//       const file = req.file;
//       if (!file) {
//         return res.status(400).send('파일이 업로드되지 않았습니다.');
//       }
//       res.status(200).json({ message: '파일 업로드 성공', filePath: file.path });
//     } catch (err) {
//       res.status(500).send(err.message);
//     }
//   });




router.post('/post/add', upload.single('image'), async (요청, 응답) => {
    try{
        const file = 요청.file;
        if(요청.body.title==''){
            응답.send('제목입력안했는데?')
        }else{
            await db.collection('post').insertOne(

                { 
                    title : 요청.body.title, 
                    content : 요청.body.content, 
                    img : 요청.file? '/uploads/' + 요청.file.filename:'', 
                    // 삼항연산자
                    // ( 조건식 ? 조건식참일때 남길거 : 조건식거짓일때 남길거)
                    user : 요청.user._id,
                    username : 요청.user.username,
                    like : 0
                }
            )
            응답.redirect('/post/list')
        }
    } catch(e){
        console.log(e)
        응답.status(500).send('서버에러남')
    }
    
})


// 정적 파일 제공 (업로드된 파일에 접근)
router.use('/uploads', express.static(path.join(__dirname, 'uploads')));


router.delete('/post/delete', async(요청, 응답)=>{
    let post = await db.collection('post').findOne({
        _id : new ObjectId(요청.query.docid)
    })
    // 사진파일 삭제 기능
    
    // 사진없는 게시글인 경우
    if(post.img==""){
        console.log("사진없는 게시글임!")
    }
    // 사진있는 게시글인 경우
    else{
        await fs.unlink(`./public/${post.img}`); // 파일 시스템에서 삭제
        console.log(`File deleted: ${post.img}`);
    }
    
    // DB에서 관련 게시글 삭제.
    if(요청.user.authority == "MANAGER"){
        await db.collection('post').deleteOne({
            _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
        })
        응답.send('삭제완료')
    }
    else{
        await db.collection('post').deleteOne({
            _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
            user : new ObjectId(요청.user._id) // 본인이 쓴글인지 확인
            })
        응답.send('삭제완료')
    }
})

router.delete('/comment/delete', async(요청, 응답)=>{
    if(요청.user.authority == "MANAGER"){
        await db.collection('comment').deleteOne({
            _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
        })
        응답.send('삭제완료')
    }
    else{
        await db.collection('comment').deleteOne({
            _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
            user : new ObjectId(요청.user._id) // 본인이 쓴글인지 확인
            })
        응답.send('삭제완료')
    }
})

router.get('/post/detail/:id',  async (요청, 응답) => {
    try{
            let comment = await db.collection('comment').find({
                parentId : new ObjectId(요청.params.id)
            }).toArray()
            let result = await db.collection('post').findOne({ 
                _id : new ObjectId(요청.params.id) 
            })
            let user = 요청.user
            응답.render('post-detail.ejs', { result : result , comment : comment , user : user})
            if(result == null){
                응답.status(404).send('이상한 url 입력함.') 
            }
        
    } catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
        // 400 -> 유저 오류 500 -> 서버오류
    }
})

router.get('/post/edit/:id', async(요청, 응답)=>{
    let result = await db.collection('post').findOne({ _id : new ObjectId(요청.params.id) })  
    응답.render('post-edit.ejs', { result : result })
})


router.put('/post/edit', async (요청, 응답) => {
        try{
            if(요청.user.authority=="MANAGER"){
                await db.collection('post').updateOne({ 
                    _id : new ObjectId(요청.body.id)
                },
                {$set : { title : 요청.body.title, content : 요청.body.content}
                })
                응답.redirect('/post/list')
            }
            else{
                await db.collection('post').updateOne({ 
                    _id : new ObjectId(요청.body.id),
                    user : new ObjectId(요청.user._id) //본인이 쓴글인지 확인
                },
                {$set : { title : 요청.body.title, content : 요청.body.content}
                })
                응답.redirect('/post/list')
            }
            
        }catch(e){
            console.log(e)
            응답.status(404).send('이상한 url 입력함.') 
        }

})


router.post('/post/comment', async (요청, 응답) => {
    await db.collection('comment').insertOne({
        comment : 요청.body.content,
        writerId : new ObjectId(요청.body._id),
        writer : 요청.user.username,
        parentId : new ObjectId(요청.body.parentId)
    })
    응답.redirect('back') // 이전페이지로 이동.
})




// 기존에 방식으로 DB에서 값을 가져오면 정확히 일치하는 제목만 가져오게됨.
// 그런 경우 정규식 쓰면 해결 ( $regex : -> 이걸로 가져오면 그 키워드가 들어간 모든 값을 다 가져옴.)
// 단점 : 느려터짐.

// search index 만들면 우리가 원하는 검색 기능 가능!
// 단어부분검색 가능, 검색속도 빠름.
router.get('/post/search', async(요청, 응답)=>{

    let 검색어 = 요청.query.val
    let 검색조건 = [
        {
            $search : {
                index : 'title_index',
                text : { query : 검색어 , path : 'title'}
            }
        }
        // {조건2}
        // {조건3}
        // {$sort : { _id : 1 }} -> id순으로 정렬(-1적으면 역순으로 정렬)
        // {$sort : { 날짜 : 1 }} -> 날짜 순으로 정렬
        // {$limit : 10} -> 검색결과수 제한
        // {$skip:10} -> 10개 건너뛰고 가져오기
        // {$project : {title :1}} -> title 필드 숨기기 (0이면 숨기기, 1이면 보이기)
    ]

    let result = await db.collection('post').aggregate(검색조건).toArray()
    응답.render('post-search.ejs', {posts : result})
})

router.post('/post/like', async(요청, 응답)=> {
    // 만일 post_id = 현재 글 id and user = 현재유저_id
    let history = await db.collection('history').findOne({
        post_id : new ObjectId(요청.body.id),
        user : 요청.user._id
    })
    if(history != null){
        await db.collection('history').deleteOne(
            {
                post_id : new ObjectId(요청.body.id),
                user : 요청.user._id
            })
        await db.collection('post').updateOne({ _id : new ObjectId(요청.body.id) }, {$inc : {like : -1}})
    }
    else{
        await db.collection('history').insertOne(
            {
                post_id : new ObjectId(요청.body.id),
                user : 요청.user._id
            })
        await db.collection('post').updateOne({ _id : new ObjectId(요청.body.id) }, {$inc : {like : 1}})
    }
    응답.redirect('back')
})


router.get('/mypage',checkLogin, async(요청,응답)=>{
    let user = await 요청.user
    let result = await db.collection('post').find({
        user : new ObjectId(요청.user._id)
    }).toArray()// 
    응답.render('mypage.ejs', {posts:result, user : user})
})

// router.get('/list/:id', async(요청, 응답)=>{
//     // 1번 ~ 5번글을 찾아서 result변수에 저장F.
//     let userid = 요청.user._id
//     let result = await db.collection('post').find().skip((요청.params.id-1)*5).limit(5).toArray()// 컬렉션의 모든 document 출력 하는 법.
//     응답.render('post-list.ejs', { posts : result , userid : userid})
// })

// router.get('/list/next/:id', async(요청, 응답)=>{
//     // 1번 ~ 5번글을 찾아서 result변수에 저장.
//     let userid = 요청.user._id
//     let result = await db.collection('post').find({_id : {$gt : new ObjectId(요청.params.id)}}).limit(5).toArray()// 컬렉션의 모든 document 출력 하는 법.
//     응답.render('post-list.ejs', { posts : result , userid : userid})
// })

module.exports = router

