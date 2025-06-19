
const router = require('express').Router()
const ObjectId = require('mongodb').ObjectId;

// DB연결
let connectDB = require('./../database.js')

let db;
connectDB.then((client)=>{
    db = client.db('forum')
}).catch((err)=>{
  console.log(err)
})

router.get('/code/list', async(요청, 응답)=>{
    if(요청.user == undefined || 요청.user.authority == "normal"){
        응답.render('login.ejs')
    }
    else{
        let result = await db.collection('code').find({
            user: 요청.user._id
        }).toArray()
        응답.render('code-list.ejs', {result : result})
    }
    
})

router.get('/code/detail/:id', async(요청, 응답)=>{
    if(요청.user == undefined || 요청.user.authority == "normal"){
        응답.render('login.ejs')
    }
    else{
        let result = await db.collection('code').findOne({
            _id : new ObjectId(요청.params.id)
        })
    
        응답.render('code-detail.ejs',{result:result})
    }
    
})

router.post('/code/add', async (요청, 응답) => {
    if(요청.user == undefined || 요청.user.authority == "normal"){
        응답.render('login.ejs')
    }
    else{
        let user = 요청.user
        let result = await db.collection('code').find({
            user : 요청.user._id
        }).toArray()
        try{
            if(요청.body.title=='' || 요청.body.content == ''){
                응답.send('내용 전부 입력안했는데?')
            }else{
                await db.collection('code').insertOne(

                    { 
                        title : 요청.body.title, 
                        content : 요청.body.content, 
                        user : 요청.user._id,
                        username : 요청.user.username,
                    }
                )
                응답.redirect('/code/list')
            }
        } catch(e){
            console.log(e)
            응답.status(500).send('서버에러남') 
        }
    }
})

router.get('/code/post', async(요청, 응답)=>{
    if(요청.user == undefined || 요청.user.authority == "normal"){
        응답.render('login.ejs')
    }
    else{
        응답.render('code-post.ejs')
    }
    
})

router.delete('/code/delete', async(요청, 응답)=>{

    await db.collection('code').deleteOne({
        _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
        user : new ObjectId(요청.user._id) // 본인이 쓴글인지 확인
        })
    응답.send('삭제완료')

})

router.put('/code/edit', async (요청, 응답) => {
    if(요청.user == undefined || 요청.user.authority == "normal"){
        응답.render('login.ejs')
    }
    else{
        try{
            let result = await db.collection('code').updateOne({ 
                _id : new ObjectId(요청.body.id),
                user : new ObjectId(요청.user._id) //본인이 쓴글인지 확인
            },
            {$set : { title : 요청.body.title, content : 요청.body.content}
            })
            응답.redirect('/code/list')
        }catch(e){
            console.log(e)
            응답.status(404).send('이상한 url 입력함.') 
        }
    }
    
})

router.get('/code/edit/:id', async(요청, 응답)=>{
    let result = await db.collection('code').findOne({ _id : new ObjectId(요청.params.id) })  
    응답.render('code-edit.ejs', { result : result })
})


module.exports = router










