const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const User = require('./models/User');
const Message = require('./models/Message');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bcrypt = require('bcrypt');
const ws = require('ws');
const fs = require('fs');

dotenv.config();
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));
app.use('/attachments',express.static(__dirname+'/attachments'));
mongoose.connect(process.env.MONGO_URL);
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);
app.get('/test',(req,res)=>{
    res.json('testing OK');
});

async function getUserDataFromReq(req){
    return new Promise((resolve,reject)=>{
        const token = req.cookies?.token;
        if(token){
            jwt.verify(token,jwtSecret,{},(err,userData)=>{
                if(err) throw err;
                resolve(userData);
            });
        }
        else{
            reject('no token');
        }
    });
}

app.get('/profile', (req,res)=>{
    const token = req.cookies?.token;
    if(token){
        jwt.verify(token,jwtSecret,{},(err,userData)=>{
            if(err) throw err;
            res.json(userData);
        });
    }
    else{
        res.status(401).json('no token');
    }
});

app.get('/messages/:userId', async (req,res)=>{
    const {userId} = req.params;
    const userData = await getUserDataFromReq(req);
    const ourUserId = userData.userId;
    const messages = await Message.find({
        sender:{$in:[userId,ourUserId]},
        recepient:{$in:[userId,ourUserId]},
    }).sort({createdAt:1});
    res.json(messages);
});

app.get('/people',async (req,res)=>{
    const users = await User.find({},{'_id':1, username:1});
    res.json(users);
})

app.post('/login', async (req,res)=>{
    const {username,password} = req.body;
    const foundUser = await User.findOne({username});
    try {
        if(foundUser){
            const passwordOk = bcrypt.compareSync(password, foundUser.password);
            if(passwordOk){
                jwt.sign({userId: foundUser._id,username,password}, jwtSecret, {}, (err,token)=>{
                    if(err) throw err;
                    res.cookie('token',token,{sameSite:'none',secure:true}).status(201).json({
                        id: foundUser._id,
                    });
                });
            }
        }
    } catch (error) {
        if(error) throw error;
        res.status(500).json('error');
    }
    
});

app.post('/logout', (req,res)=>{
    res.cookie('token','',{sameSite:'none',secure:true}).json('ok');
})

app.post('/register', async (req,res)=>{
    const {username,password} = req.body;
    try {
        console.log(password);
        const hashedPassword = bcrypt.hashSync(password,bcryptSalt);
        const createdUser = await User.create({
            username:username,
            password:hashedPassword
        });
        jwt.sign({userId: createdUser._id,username,password},jwtSecret, {}, (err,token)=>{
            if(err) throw err;
            res.cookie('token',token,{sameSite:'none',secure:true}).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (error) {
        if(error) throw error;
        res.status(500).json('error');
    }
});



const server = app.listen(4000);

const wss = new ws.WebSocketServer({server});
wss.on('connection',(connection,req)=>{
    function notifyAboutOnliners(){
        [...wss.clients].forEach(client=>{
            client.send(JSON.stringify({
                online: [...wss.clients].map(c=>({userId:c.userId, username:c.username}))
            }));
        })
    }

    connection.isAlive = true;
    connection.timer = setInterval(() => {
        connection.ping();
        connection.killed = setTimeout(()=>{
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnliners();
        },1000);
    }, 5000);
    connection.on('pong',()=>{
        clearTimeout(connection.killed);
    })
    const cookies = req.headers.cookie;
    if(cookies){
        const tokenCookieStr = cookies.split(';').find(str => str.startsWith('token='));
        if(tokenCookieStr){
            const token = tokenCookieStr.split('=')[1];
            if(token){
              jwt.verify(token,jwtSecret,{},(err,userData)=>{
                if(err) throw err;
                // console.log(userData);
                const {userId,username} = userData;
                connection.userId = userId;
                connection.username = username;
              })  
            }
        }
    }
    connection.on('message', async (message)=>{
        const messageData = JSON.parse(message.toString());
        // console.log(messageData);
        const {recepient, text, file} = messageData;
        let fileName = null;
        if(file){
            const parts = file.name.split('.');
            const ext = parts[parts.length-1];
            fileName = Date.now()+'.'+ext;
            const path = __dirname+'/attachments/'+fileName;
            const fileData = new Buffer.from(file.data.split(',')[1],'base64');
            fs.writeFile(path, fileData, ()=>{
                console.log("file Saved "+path);
            })
        }
        if(recepient && (text || file)){
            const MessageDoc = await Message.create({
                sender: connection.userId,
                recepient,
                text,
                file: file ? fileName : null,
            });
            [...wss.clients].filter(c=>c.userId === recepient).forEach(c=>c.send(JSON.stringify({
                text,
                sender:connection.userId,
                recepient,
                file: file?fileName:null,
                _id: MessageDoc._id})));
        }
    });

    // console.log([...wss.clients].map(c=>c.username));
    notifyAboutOnliners();
    
});