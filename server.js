// 밑에 2줄은 express 라이브러리 사용하겠다는 뜻.
const express = require('express')
const app = express()

// mongodb 셋팅
const { MongoClient, ObjectId } = require('mongodb')
const methodOverride = require('method-override')
//bcrypt 라이브러리 셋팅
const bcrypt = require('bcrypt')

// socket 라이브러리 셋팅
const { createServer } = require("http");
const { Server } = require('socket.io')
const { join } = require("path");
const server = createServer(app)
const io = new Server(server) 

// moment 샛팅
const moment = require('moment')


// ddd
// 환경변수 따로 파일로 만들기.
// npm install dotenv 설치
require('dotenv').config()

//ejs 셋팅 하는 코드
app.set('view engine', 'ejs')
// html 파일에 데이터를 넣고 싶으면 .ejs 파일로 만들어야 가능.
// ejs파일은 꼭 views라는 폴더를 만들어서 생성.

app.use(methodOverride('_method'))

// 폴더를 server.js에 등록해두면 폴더안의 파일들 html에서 사용 가능.
app.use(express.static(__dirname +'/public'))
app.use(express.static(__dirname +'/img'))

// 요청.body 쓰러면 필수적으로 작성해야 됨.
app.use(express.json())
app.use(express.urlencoded({extended:true})) 

// passport 라이브러리 셋팅 시작
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

// connect-mongo 라이브러리 셋팅
const MongoStore = require('connect-mongo') 
const e = require('express')



app.use(passport.initialize())
app.use(session({
  secret: process.env.SESSION_PW , // 세션의 document id는 암호화해서 유저에게 보냄
  resave : false, // 유저가 서버로 요청할 때마다 세션 갱신할건지(보통은 false함.)
  saveUninitialized : false, // 로그인 안해도 세션 만들것인지(보통 false)
  cookie : { maxAge : 60* 60 * 1000 } ,// 세션 document 유효기간 변경 하는 코드(60*1000 -> 60초, 60*60*1000 -> 1시간)
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : 'forum'
  })
}))

app.use(passport.session()) 
// passport 라이브러리 셋팅 끝.

const sessionMiddleware = session({
    secret: process.env.MIDDLESESSION_PW,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge : 60*60*1000,
        secure : false,
        sameSite:'strict'
    },
    store: MongoStore.create({
        mongoUrl : process.env.DB_URL,
        dbName : 'forum'
    })
  });

app.use(sessionMiddleware);





// MongoDB 연결하기 위해 하는 셋팅

const { render } = require('ejs')
let changeStream

let connectDB = require('./database.js')
let db;

connectDB.then((client)=>{
    db = client.db('forum')

    // GET요청 할때마다 실행되기 때문에 DB 처음 연결할때 한번만 실행되도록 위치를 셋팅
    // document에 insert 되는 경우만 감지하고 싶은 경우.
    let 조건 =[
        { $match : {operationType : 'insert'}}
    ]

    changeStream = db.collection('post').watch(조건) // post 컬렉션의 변동사항을 감지(watch()-> 괄호 안에 조건 입력 가능)

    server.listen(process.env.PORT, () => {
        console.log('http://localhost:8083 에서 실행 중')
    })
}).catch((err)=>{
  console.log(err)
})





// 세션 데이터를 DB에 저장하려면 connect-mongo 라이브러리 설치

// 필요한 라이브러리 npm install express-session passport passport-local 
// passport는 회원인증 도와주는 메인라이브러리,
// passport-local은 아이디/비번 방식 회원인증쓸 때 쓰는 라이브러리
// express-session은 세션 만드는거 도와주는 라이브러리입니다.


// 회원관련 기능 
// 제출한 아이디 비번이 DB에 있는지 검사하는 로직
// 있으면 세션만들어줌
// 이 밑에 있는 코드를 실행하고 싶으면 passport.authenticate('local')() 쓰면 됨.

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
    let result = await db.collection('user').findOne({ userid : 입력한아이디})
    if (!result) {
      return cb(null, false, { message: '아이디 DB에 없음' })
    }

    if (await bcrypt.compare(입력한비번, result.password)) {
      return cb(null, result)
    } else {
      return cb(null, false, { message: '비번불일치' });
    }
  }))

// 밑에 내용은 요청.login() 실행할때마다 같이 실행됨.
// 세션 document에 들어갈 내용들을 보내줌.
passport.serializeUser((user, done) =>{
    process.nextTick(() => { // 내부 코드를 비동기적으로 처리해줌
        done(null, { id : user._id , userid: user.userid })
    })
})


// 밑에 내용은 마찬가지로 요청.login() 실행할때마다 같이 실행됨.
// 쿠키를 분석해주는 역할(입장권 확인 역할)
// 이 밑 코드가 있으면 아무대서나 요청.user 사용하면 로그인한 사용자의 정보를 보내줌. 
passport.deserializeUser(async (user, done) =>{
    let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})
    delete result.password // 비번은 삭제
    process.nextTick(() => { // 내부 코드를 비동기적으로 처리해줌
        done(null, result) // result에 저장된 값이 요청.user에 들어감.
    })
})


app.get('/', async(요청, 응답)=>{
    
    if(요청.user == undefined || 요청.user.authority=="normal"){
        응답.sendFile(__dirname+'/index.html')
    }
    else{
        let result = await db.collection('post').find().limit(3).toArray()
        응답.render('login-index.ejs', {result: result})
    }
})

// __dirname -> 현재 프로젝트 절대 경로 의미.(server.js가 담긴 폴더)
app.get('/home', async(요청,응답)=>{
    if(요청.user == undefined || 요청.user.authority=="normal"){
        응답.sendFile(__dirname+'/index.html')
    }
    else{
    
        응답.render('login-index.ejs')
    }

})

// 로그인 관련 기능
app.get('/login',checkLogin, async(요청,응답)=>{
    응답.render('login.ejs')
})

app.post('/login', async(요청,응답, next)=>{
    let result = await db.collection('post').find().limit(3).toArray()
    passport.authenticate('local', (error, user, info)=>{
        
        if(error) return 응답.status(500).json(error) // 에러에 뭐가 들어오면 에러500 보내줌.
        if(!user) return 응답.status(401).json(info.message) // DB에 있는거랑 비교해봤는데 맞지 않는 경우
        
        // 밑에꺼 실행되면 세션만들기가 실행됨.
        // 요청.logIn()이 실행되면 쿠키생성 및 쿠기 확인까지 실행됨.
        
        요청.logIn(user, (err)=>{
            if(err) return next(err)
            응답.render('login-index.ejs', {result:result}) // 로그인 완료시 실행할 코드
        })

    })(요청, 응답, next)

})

app.get("/logout",checkLogin, function(req, res) {
    req.logout(()=>{
        res.redirect('/')
    })
});

// 회원가입 기능
app.get('/register' , (요청, 응답)=>{
    응답.render('register.ejs')
})



app.post('/register' , async(요청, 응답)=>{
  
    let 해시 = await bcrypt.hash(요청.body.password, 10)
    // 기존의 비밀번호를 해싱을 해서 암호화 하는 작업.
    let result = await db.collection('user').findOne({ userid : 요청.body.userid })  

    if(요청.body.userid == '' || 요청.body.username == '' || 요청.body.password == ''){
        응답.send('입력되지 않은 칸이 있습니다. 다시 확인해주세요.')
    }
    else if(요청.body.password != 요청.body.password_check){
        응답.send('입력되지 않은 칸이 있습니다. 다시 확인해주세요.')
    }
    else if(!result){
        await db.collection('user').insertOne({ 
            
            username : 요청.body.username,
            userid : 요청.body.userid,
            password : 해시, //해싱한 값을 비번에 저장.   
            authority : "normal"
        })
        응답.redirect('/')
    }
    else{
        응답.send('이미 존재하는 아이디입니다. 다시 입력해주세요.')
    } 

})

// 비밀번호 변경 기능
app.get('/change/pw/:id', (요청, 응답)=>{
    let user = new ObjectId(요청.params.id)
    응답.render('change-pw.ejs', {user, user})
})

// 유저 비밀번호 변경
app.post('/change/pw', async (요청, 응답) => {
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


app.use('/', require('./routes/post.js'))
app.use('/', require('./routes/code.js'))
app.use('/', require('./routes/manage.js'))


// await db.collection('post').updateOne({ _id : 1 }, {$inc : {like : 2}}) // inc -> 값을 + - 하는 문법
// 동시에 여러개 document 수정 하는방법.
// await db.collection('post').updateMany({ _id : 1 }, {$inc : {like : 2}})
// like 항목이 10 이상인 document 전부 수정 하는 방법
// await db.collection('post').updateMany({ like : {$gt :10} }, {$inc : {like : 2}}) 
// $gt : 10 -> like 항목이 10 이상인가 $lt는 이하 $ne는 not 효과


// 채팅 관련 기능
app.get('/make-chat',checkLogin, async(요청, 응답)=>{
    let check = await db.collection('chatroom').findOne({
        member : [요청.user._id, new ObjectId(요청.query.writerId)]
    })
    if(check == null){
        check = await db.collection('chatroom').findOne({
            member : [new ObjectId(요청.query.writerId) , 요청.user._id]
        })
        if(check == null){
            await db.collection('chatroom').insertOne({
                // member 안에 방문자_id와 작성자의_id 를 각각 저장
                member : [요청.user._id, new ObjectId(요청.query.writerId)],
                date : new Date()
            })
            응답.redirect('/mychat')
        }
        else{
            응답.redirect('/mychat')
        }
    }
    else{
        응답.redirect('/mychat')
    }
})


app.get('/mychat',checkLogin, async(요청, 응답)=>{
        let result = await db.collection('chatroom').find({
            member : new ObjectId(요청.user._id)
        }).toArray()
        let opponent_id = []
        for(let i =0;i<result.length;i++){
            if(JSON.stringify(result[i].member[0]) == JSON.stringify(요청.user._id)){
                opponent_id[i] = result[i].member[1]
            }
            else{
                opponent_id[i] =  result[i].member[0]
            }
        }
        let opponent = []
        for(let i =0;i<opponent_id.length;i++){
            opponent[i] =  await db.collection('user').findOne({
                _id : new ObjectId(opponent_id[i])
            })
        }
        응답.render('chat-mychat.ejs', { result : result , opponent: opponent })
})


app.get('/mychat/:id',checkLogin, async(요청, 응답)=>{

        let result = await db.collection('chatroom').findOne({
            _id : new ObjectId(요청.params.id)
        })
        let user = new ObjectId(요청.user._id)
        let myname_id = ''
        let opponent_id = ''
        let myname = ''
        let opponent = ''
        if(JSON.stringify(요청.user._id) == JSON.stringify(result.member[0])){
            myname_id = result.member[0]
            opponent_id = result.member[1]
            myname = await db.collection('user').findOne({
                _id : myname_id
            })
            opponent = await db.collection('user').findOne({
                _id : opponent_id
            })
            myname = myname.username
            opponent = opponent.username
        }
        else{
            myname_id = result.member[1]
            opponent_id = result.member[0]
            myname = await db.collection('user').findOne({
                _id : myname_id
            })
            opponent = await db.collection('user').findOne({
                _id : opponent_id
            })
            myname = myname.username
            opponent = opponent.username
        }
        try{
            if(JSON.stringify(요청.user._id) == JSON.stringify(result.member[0]) || JSON.stringify(요청.user._id) == JSON.stringify(result.member[1])){
    
                let chatcontent = await db.collection('chatcontent').find({
                    parent_id : new ObjectId(요청.params.id),
                }).toArray()
                응답.render('chat-detail.ejs', { result : result , chatcontent: chatcontent , user : user, myname: myname, opponent:opponent}) 
            }
            else{
                응답.redirect('/login')
            }
        }
        catch(e){
            console.log(e)
            응답.status(404).send('채팅방이 사라졌습니다.')
        }
})

app.delete('/chatroom/delete',checkLogin, async(요청, 응답)=>{

    await db.collection('chatroom').deleteOne({
        _id : new ObjectId(요청.query.docid), 
        })
    응답.send('삭제완료')
    
})



io.engine.use(sessionMiddleware)

// 웹소켓 연결되면 실행되는 코드
io.on('connection', (socket)=>{

    // 보낸 데이터를 받으려면 socket.on() 사용.
    // socket.on('age', (data)=>{
    //     console.log('유저가보낸거', data)
    // })

    // [서버 -> 모든유저] 데이터 전송
    io.emit('name', 'paul') 
    
    // socket.join('1') // 유저를 room으로 보냄.(모든사람에게 데이터를 주는게 아니라, 룸에 있는 사람에게만 데이터를 전송하기 위해서 룸으로 보내면 좋음)

    // 룸 join 요청이 왔을 때 조인시키는 명령어.
    socket.on('ask-join', (data)=>{
        // console.log(socket.request.session) // 현재 로그인된 유저가 뜸.
        socket.join(data)
    })

    // 특정 룸에만 데이터를 전송하는 방법
    socket.on('message', (data)=>{
        
        // DB에 채팅 내용 저장하기(채팅내용, 날짜, 부모_id, 작성자)
        db.collection('chatcontent').insertOne({
            content : data.msg,
            date : new Date(),
            time : moment().format('hh:mm'),
            parent_id : new ObjectId(data.room) ,
            writer : new ObjectId(socket.request.session.passport.user.id)
        })

        // 특정 룸에 데이터 뿌리기
        io.to(data.room).emit('broadcast', {data : data.msg, user : new ObjectId(socket.request.session.passport.user.id), time :moment().format('hh:mm')})
    })
})


app.get('/stream/list', (요청,응답)=>{

    // 끊지 않고 요청이 유지됨.
    응답.writeHead(200, {
        "connection" : "keep-alive",
        "Content-Type" : "text/event-stream",
        "cache-control" : "no-cache",
    })

    // 변동사항을 출력하거나 알고 싶을때 (result안에 변동사항이 들어있음.) 
    changeStream.on('change', (result)=>{
        // console.log(result.fullDocument)
        응답.write('event: msg\n')
        응답.write(`data: ${JSON.stringify(result.fullDocument)}\n\n`)
    })
    // MongoDB change stream -> DB 변동사항을 실시간으로 서버에 알려줌

    // 1초에 한번씩 서버에서 데이터 보내기.
    // setInterval(()=>{
    //     응답.write('event: msg\n')
    //     응답.write('data: 바보\n\n')
    // }, 1000)
    
})





function checkLogin(요청, 응답, next){
    if(요청.user && 요청.user.authority == "FC"){
        next()
    } else if(요청.user && 요청.user.authority == "MANAGER"){
        next()
    }else {
        응답.render('login.ejs')
    }
}
