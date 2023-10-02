const express = require('express')
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const dotenv = require('dotenv'); // Importe a biblioteca dotenv
const path = require('path');


const app = express()

app.use(express.json())

// Carregue as variáveis de ambiente do arquivo .env
dotenv.config();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ limit: '5000mb', extended: true }));


const User = require('./Models/Users')

app.get('/', async (req, res) =>{
    return res.status(200).json({"Mensagem":"Conectado"})
})

//ClientsInfo

app.get('/user/:id', async(req, res) =>{
const id = req.params.id

const user = await User.findById(id, '-Pass')

    if(!user) {
        return res.status(402).json({ msg: 'Usuário não encontrado!' })
    }


    res.status(200).json({ user })

})


//ClientsInfo

app.put('/user/edit/:id', async(req, res) =>{
  
  try {

    const id = req.params.id
    const { Status } = req.body
    const Edit = {Status}

    const user = await User.findById(id, '-Pass')

    if(!user) {

        return res.status(402).json({ msg: 'Usuário não encontrado!' })
    
    }else {

        const user = await User.updateOne({ Status })
        res.status(200).json({ user, "Menssagem":"Alterado com sucesso" })

    }  


    
} catch (error) {
    res.status(400).json({error})
}

})


//CreatUsers


app.post('/Creat/User', async(req, res) =>{

    const { Name, Pass, ConfirmPass, Email, Status } = req.body

//Validações 

if(!Name){
    return res.status(422).json({"Mensagem":"O usuário é obrigatório"})
}
if(!Pass){
    return res.status(422).json({"Mensagem":"A senha é obrigatoria"})
}
if(ConfirmPass !== Pass){
    return res.status(422).json({"Mensagem":"As senhas não conferem"})
}
if(!Email){
    return res.status(422).json({"Mensagem":"O email é obrigatoria"})
}
if(!Status){
    return res.status(422).json({"Mensagem":"O status é obrigatoria"})
}

//ChechEmail 

const UserEmailExists = await User.findOne({ Email: Email })

if (UserEmailExists){
    return res.status(422).json({"Mensagem":"Email já cadastrado!"})
}

//Criando pass

const salt  = await bcrypt.genSalt(12)
const PassHash = await bcrypt.hash(Pass, salt)

// CriandoUser

const user = new User({
    Name,
    Email,
    Pass: PassHash,
    Status,

})

try {
    await user.save()
    res.status(201).json({"Mensagem":"Usuário cadastrado com sucesso"})

} catch (error) {
    console.log(error)

    res
        .status(500)
        .json({
            "Mensagem":"Erro ao se comunicar com o servidor"
        })

}


})


//Auth

app.post('/user', async(req, res) =>{

    const { Name, Pass } = req.body
    
  
//Validações

    if(!Name){
        return res.status(422).json({"Mensagem":"O usuário é obrigatório"})
    }
    if(!Pass){
        return res.status(422).json({"Mensagem":"A senha é obrigatoria"})
    }


//check

const user = await User.findOne({ Name: Name })

if(!user){
    return res.status(422).json({ "Mensagem": "Usuário não encontrado"})
}

//checkPass

const CheckPass = await bcrypt.compare(Pass, user.Pass)

if(!CheckPass){
    return res.status(422).json({ "Mensagem": "Senha inválida"})
}

try {

    const secret = process.env.SECRET

    const token = jwt.sign(
    {
        id: user._id,
    },
    secret,
    )

    const StatusClient = user.Status

    res.status(200).json({"Mensagem":"Usuário autenticado com sucesso", token, StatusClient})
    
    
}catch(err){
    console.log('Erro na autenticação')
}


})


const dbUser = process.env.DB_USER
const dbPass = process.env.DB_PASS

const dbURI = `mongodb+srv://${dbUser}:${dbPass}@mydatabase.hltizux.mongodb.net/mydatabase?retryWrites=true&w=majority`;

mongoose.connect(dbURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Conexão com o MongoDB estabelecida');
    app.listen(31313)
    console.log('Server Runing')

  })
  .catch(err => {
    console.error('Erro ao conectar ao MongoDB', err);
  });


