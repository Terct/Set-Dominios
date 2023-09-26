const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios'); // Importe a biblioteca axios
const dotenv = require('dotenv'); // Importe a biblioteca dotenv
const bodyParser = require('body-parser');
const multer = require('multer'); // Importe a biblioteca multer para lidar com o upload de arquivos
const fs = require('fs');


// Carregue as variáveis de ambiente do arquivo .env
dotenv.config();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ limit: '5000mb', extended: true }));
app.use(bodyParser.json());

// Configuração do multer para lidar com o upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.post('/setdominio', upload.none(), async (req, res) => {
    const { dominio, client, url_bot } = req.body;

    // Criar o arquivo de proxy reverso
    const proxyConfig = `
 
        server {
            server_name ${dominio};
           
            location / {
           
              proxy_pass http://127.0.0.1:9001;
           
              proxy_http_version 1.1;
           
              proxy_set_header Upgrade $http_upgrade;
           
              proxy_set_header Connection 'upgrade';
           
              proxy_set_header Host $host;
           
              proxy_set_header X-Real-IP $remote_addr;
           
              proxy_set_header X-Forwarded-Proto $scheme;
           
              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           
              proxy_cache_bypass $http_upgrade;
           
                }
           
        }
    `;

    // Salvar o arquivo na pasta ./Proxys
    const filePath = `./Proxys/${dominio}.conf`;

    try {
        fs.writeFileSync(filePath, proxyConfig);

        // Salvar os dados no arquivo de banco de dados na pasta Users/data
        const data = { dominio, client, url_bot };
        const databasePath = './Data.json';

        // Ler o arquivo de banco de dados existente (se houver)
        let database = [];
        if (fs.existsSync(databasePath)) {
            const rawData = fs.readFileSync(databasePath);
            database = JSON.parse(rawData);
        }

        // Adicionar os novos dados ao banco de dados
        database.push(data);

        console.log(data)

        // Salvar o banco de dados atualizado
        fs.writeFileSync(databasePath, JSON.stringify(database));

        res.send('Proxy reverso criado e dados salvos com sucesso.');
    } catch (error) {
        res.status(500).send('Erro ao criar proxy reverso e salvar os dados.');
    }
});



const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
