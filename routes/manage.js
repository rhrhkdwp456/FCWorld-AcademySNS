
const router = require('express').Router()
const ObjectId = require('mongodb').ObjectId;

let connectDB = require('./../database.js')

let db;
connectDB.then((client)=>{
    db = client.db('forum')
}).catch((err)=>{
  console.log(err)
})


router.get('/manager', async(요청, 응답)=>{
    if(요청.user.authority=="MANAGER"){
        let result = await db.collection('user').find().toArray()
        응답.render('manager.ejs' , {posts : result})
    }
    else{
        응답.redirect('/home')
    }
})

// 권한 부여
router.get('/authority', async(요청,응답)=>{
    if(요청.user.authority=="MANAGER"){
        let result = await db.collection('user').updateOne({
            _id : new ObjectId(요청.query.docid),
        },
        {$set : { authority : "FC"}
        })
        응답.redirect('back')
    }
    else{
        응답.redirect('/home')
    }
})


// 회원 관리에서 회원 삭제 기능
router.delete('/user-delete', async(요청, 응답)=>{
    if(요청.user.authority == "MANAGER"){
        await db.collection('user').deleteOne({
            _id : new ObjectId(요청.query.docid), // 게시글 아이디 확인
        })
        응답.send('삭제완료')
    }
    else{
        응답.redirect('/home')
    }
})


// 비밀번호 변경 기능
router.get('/change/pw/:id', (요청, 응답)=>{
    let user = new ObjectId(요청.params.id)
    응답.render('change-pw.ejs', {user, user})
})

// 유저 비밀번호 변경
router.post('/change/pw', async (요청, 응답) => {
    try{
        if(요청.user.authority=="MANAGER"){
            let 해시 = await bcrypt.hash(요청.body.password, 10)
            await db.collection('user').updateOne({ 
                _id : new ObjectId(요청.body.id)
            },
            {$set : { password: 해시}
            })
            응답.redirect('/manager')
        }
        

    }catch(e){
        console.log(e)
        응답.status(404).send('이상한 url 입력함.') 
    }

})


module.exports = router