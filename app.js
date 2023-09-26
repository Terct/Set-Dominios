const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios'); // Importe a biblioteca axios
const dotenv = require('dotenv'); // Importe a biblioteca dotenv
const bodyParser = require('body-parser');
const multer = require('multer'); // Importe a biblioteca multer para lidar com o upload de arquivos
const fs = require('fs');
const { exec } = require('child_process');
const crypto = require('crypto')

// Carregue as variáveis de ambiente do arquivo .env
dotenv.config();

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ limit: '5000mb', extended: true }));
app.use(bodyParser.json());

// Configuração do multer para lidar com o upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


function generateRandomFolderName() {
  return crypto.randomBytes(5).toString('hex'); // Gera 10 caracteres aleatórios em hexadecimal
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.post('/setdominio', upload.none(), async (req, res) => {
    const { dominio, client, url_bot } = req.body;

    // Gerar o nome da pasta aleatória
    const randomFolderName = generateRandomFolderName();
    const folderPath = `/root/myapp/Set-Dominios/public/Pages/${randomFolderName}`;
  
    // Criar a pasta se não existir
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
  
    // Criar o arquivo index.html com o conteúdo "Olá Mundo"
    const indexPath = `${folderPath}/index.html`;
    const indexContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exemplo de Iframe</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }

        iframe {
            border: none;
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <iframe src="${url_bot}"></iframe>
</body>
</html>`;
    
    fs.writeFileSync(indexPath, indexContent);

      // Configurar o proxy reverso com o diretório gerado como raiz do domínio
  const proxyConfig = `
  server {
    server_name ${dominio};
  
    location / {
      proxy_pass http://127.0.0.1:3000/Pages/${randomFolderName}/;
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
  const filePath = `/etc/nginx/sites-available/${dominio}.conf`;

  try {
    fs.writeFileSync(filePath, proxyConfig);
  
    const symlinkCommand = `sudo ln -s ${filePath} /etc/nginx/sites-enabled/${dominio}.conf`;
  
    // Verificar a sintaxe do arquivo de configuração do Nginx antes de prosseguir
    const nginxSyntaxCheckCommand = 'sudo nginx -t';
    exec(nginxSyntaxCheckCommand, (nginxError, nginxStdout, nginxStderr) => {
      if (nginxError) {
        console.error(`Erro na sintaxe do arquivo de configuração do Nginx: ${nginxError}`);
        // Remover arquivos gerados, se houver
        try {
          fs.unlinkSync(filePath); // Remove o arquivo de configuração do Nginx
          fs.unlinkSync(`/etc/nginx/sites-enabled/${dominio}.conf`); // Remove o link simbólico
          fs.rmdirSync(folderPath, { recursive: true }); // Remove a pasta gerada
        } catch (removeError) {
          console.error(`Erro ao remover os arquivos gerados: ${removeError}`);
        }
        res.status(500).send('Erro na sintaxe do arquivo de configuração do Nginx.');
      } else {
        // A sintaxe do arquivo de configuração do Nginx está correta, continue com o link simbólico
        exec(symlinkCommand, (error, stdout, stderr) => {
          if (error) {
            if (stderr.includes('File exists')) {
              console.log(`O link simbólico já existe: ${stderr}`);
              // Se o link simbólico já existe, você pode continuar o fluxo normalmente
            } else {
              console.error(`Erro ao criar o link simbólico: ${error}`);
              res.status(500).send('Erro ao criar proxy reverso e criar o link simbólico.');
              return; // Encerre a execução da função aqui para evitar execuções adicionais
            }
          } else {
            console.log(`Link simbólico criado com sucesso: ${stdout}`);
          }
  
          // Gerar o certificado SSL usando o Certbot
          const certbotCommand = `sudo certbot --nginx --email dagestaoemail@gmail.com --redirect --agree-tos -d ${dominio} --non-interactive`;
  
          exec(certbotCommand, (certbotError, certbotStdout, certbotStderr) => {
            if (certbotError) {
              console.error(`Erro ao gerar o certificado SSL: ${certbotError}`);
              res.status(500).send('Erro ao gerar o certificado SSL.');
            } else {
              console.log(`Certificado SSL gerado com sucesso: ${certbotStdout}`);
  
              const data = { dominio, client, url_bot, randomFolderName };
              const databasePath = './Data.json';
              let database = [];
  
              if (fs.existsSync(databasePath)) {
                const rawData = fs.readFileSync(databasePath);
                database = JSON.parse(rawData);
              }
  
              database.push(data);
  
              fs.writeFileSync(databasePath, JSON.stringify(database));
  
              res.send('Proxy reverso criado, link simbólico criado e certificado SSL gerado com sucesso.');
            }
          });
        });
      }
    });
  } catch (error) {
    console.error(`Erro ao criar proxy reverso: ${error}`);
    res.status(500).send('Erro ao criar proxy reverso e salvar os dados.');
  }

});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});