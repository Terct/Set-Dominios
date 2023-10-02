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

app.get('/consulta', (req, res) => {
  res.sendFile(__dirname + '/public/consulta.html');
});

app.get('/consultarDados', (req, res) => {
  try {
    // Leia o conteúdo do arquivo Data.json
    const rawData = fs.readFileSync('./Data.json');
    const data = JSON.parse(rawData);

    // Envie os dados como resposta
    res.json(data);
  } catch (error) {
    console.error('Erro ao ler o arquivo Data.json:', error);
    res.status(500).send('Erro ao ler os dados.');
  }
});


app.post('/setdominio', upload.none(), async (req, res) => {
  const { dominio, client, url_bot, pageName } = req.body;

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
    <title>${pageName}</title>
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
<iframe id="meuIframe" src="${url_bot}"></iframe>
<script>
document.addEventListener("DOMContentLoaded", function() {
  var iframe = document.getElementById("meuIframe");

  // Adiciona um ouvinte de mensagem para ouvir as mensagens do iframe
  window.addEventListener("message", function(event) {
    // Verifica se a mensagem é do tipo "urlChange"
    if (event.data.type === "urlChange") {
      // Obtém a nova URL do evento
      var newURL = event.data.url;
      
      // Redireciona a página principal para a nova URL
      window.location.href = newURL;
    }
  });
});
</script>
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

              const status = "Ativado"
              const data = { dominio, client, url_bot, randomFolderName, pageName, status };
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


app.post('/disable/:id', (req, res) => {
  const { id } = req.params;

  // Verifique se a página com o ID especificado existe
  const folderPath = `./public/Pages/${id}`;
  if (fs.existsSync(folderPath)) {
    // Crie um arquivo HTML temporário com a mensagem de página desativada
    const indexPath = `${folderPath}/index.html`;
    const indexContent = `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Página Temporariamente Desativada</title>
      <style>
        /* Estilo para o corpo da página */
        body {
          font-family: Arial, sans-serif;
          background-color: #f1f1f1;
          text-align: center;
        }
    
        /* Estilo para o contêiner principal */
        .container {
          background-color: #ffffff;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          margin: 100px auto;
          max-width: 600px;
        }
    
        /* Estilo para o cabeçalho */
        h1 {
          color: #333;
        }
    
        /* Estilo para o texto adicional */
        h3 {
          color: #666;
        }
    
        /* Estilo para a imagem do robô desativado */
        img {
          max-width: 100%;
          height: auto;
        }
    
        /* Estilo para dispositivos de tela pequena */
        @media (max-width: 768px) {
          .container {
            max-width: 90%;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://static.vecteezy.com/system/resources/thumbnails/008/568/882/small/website-page-not-found-error-404-robot-character-broken-chatbot-mascot-disabled-site-on-technical-work-web-design-template-cartoon-online-bot-crash-accident-robotic-assistance-failure-eps-vector.jpg" alt="Robô Desativado">
        <h1>Esta página está temporariamente desativada</h1>
        <h3>Entre em contato com a administração</h3>
      </div>
    </body>
    </html>
    
    `;

    fs.writeFileSync(indexPath, indexContent);

    // Defina o status como "Desativado" no arquivo Data.json
    const databasePath = './Data.json';
    if (fs.existsSync(databasePath)) {
      const rawData = fs.readFileSync(databasePath);
      let database = JSON.parse(rawData);

      const pageData = database.find(item => item.randomFolderName === id);
      if (pageData) {
        pageData.status = "Desativado";
        fs.writeFileSync(databasePath, JSON.stringify(database));

        res.send(`Página com ID ${id} foi desativada com sucesso.`);
        return;
      }
    }

    res.status(500).send('Erro ao atualizar o status da página.');
  } else {
    res.status(404).send('Página não encontrada.');
  }
});

app.post('/enable/:id', (req, res) => {
  const { id } = req.params;
  const { url_bot, pageName } = req.body;

  // Verifique se a página com o ID especificado existe
  const folderPath = `./public/Pages/${id}`;
  if (fs.existsSync(folderPath)) {
    // Crie o conteúdo HTML com base no modelo fornecido
    const htmlContent = `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${pageName}</title>
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
      <iframe id="meuIframe" src="${url_bot}"></iframe>
  <script>
  document.addEventListener("DOMContentLoaded", function() {
    var iframe = document.getElementById("meuIframe");

    // Adiciona um ouvinte de mensagem para ouvir as mensagens do iframe
    window.addEventListener("message", function(event) {
      // Verifica se a mensagem é do tipo "urlChange"
      if (event.data.type === "urlChange") {
        // Obtém a nova URL do evento
        var newURL = event.data.url;
        
        // Redireciona a página principal para a nova URL
        window.location.href = newURL;
      }
    });
  });
</script>
    </body>
    </html>
    `;

    // Salve o conteúdo HTML no arquivo index.html
    const indexPath = `${folderPath}/index.html`;
    fs.writeFileSync(indexPath, htmlContent);

    // Defina o status como "Ativado" no arquivo Data.json
    const databasePath = './Data.json';
    if (fs.existsSync(databasePath)) {
      const rawData = fs.readFileSync(databasePath);
      let database = JSON.parse(rawData);

      const pageData = database.find(item => item.randomFolderName === id);
      if (pageData) {
        pageData.status = "Ativado";
        fs.writeFileSync(databasePath, JSON.stringify(database));

        res.send(`Página com ID ${id} foi ativada com sucesso.`);
        return;
      }
    }

    res.status(500).send('Erro ao atualizar o status da página.');
  } else {
    res.status(404).send('Página não encontrada.');
  }
});


app.post('/delete/:id', (req, res) => {
  const { id } = req.params;

  // Encontre o domínio associado a este ID no arquivo Data.json
  const databasePath = './Data.json';
  if (fs.existsSync(databasePath)) {
    const rawData = fs.readFileSync(databasePath);
    let database = JSON.parse(rawData);

    const pageDataIndex = database.findIndex(item => item.randomFolderName === id);
    if (pageDataIndex !== -1) {
      const { dominio } = database[pageDataIndex];

      // Remova a pasta com base no ID usando rm -r
      const folderPath = `/root/myapp/Set-Dominios/public/Pages/${id}`;
      exec(`rm -r ${folderPath}`, (rmError, rmStdout, rmStderr) => {
        if (rmError) {
          console.error(`Erro ao excluir a pasta com ID ${id}: ${rmError}`);
          res.status(500).send(`Erro ao excluir a pasta com ID ${id}.`);
        } else {
          console.log(`Pasta com ID ${id} excluída com sucesso.`);

          // Remova o arquivo de configuração do Nginx com base no domínio
          const nginxConfigPath = `/etc/nginx/sites-available/${dominio}.conf`;
          const nginxEnabledPath = `/etc/nginx/sites-enabled/${dominio}.conf`;
          exec(`rm ${nginxConfigPath}`, (nginxConfigError, nginxConfigStdout, nginxConfigStderr) => {
            if (nginxConfigError) {
              console.error(`Erro ao excluir o arquivo de configuração do Nginx: ${nginxConfigError}`);
            } else {
              console.log(`Arquivo de configuração do Nginx com domínio ${dominio} excluído com sucesso.`);
            }

            // Remova o arquivo de configuração habilitado
            exec(`rm ${nginxEnabledPath}`, (nginxEnabledError, nginxEnabledStdout, nginxEnabledStderr) => {
              if (nginxEnabledError) {
                console.error(`Erro ao excluir o arquivo de configuração habilitado do Nginx: ${nginxEnabledError}`);
              } else {
                console.log(`Arquivo de configuração habilitado do Nginx com domínio ${dominio} excluído com sucesso.`);
              }

              // Remova o registro do Data.json com base no ID
              database.splice(pageDataIndex, 1);
              fs.writeFileSync(databasePath, JSON.stringify(database));

              // Reinicie o Nginx
              exec('sudo service nginx restart', (nginxError, nginxStdout, nginxStderr) => {
                if (nginxError) {
                  console.error(`Erro ao reiniciar o Nginx: ${nginxError}`);
                  res.status(500).send('Erro ao reiniciar o Nginx.');
                } else {
                  console.log('Nginx reiniciado com sucesso.');
                  res.send(`Página com ID ${id} e domínio ${dominio} foi excluída com sucesso.`);
                }
              });
            });
          });
        }
      });
    } else {
      res.status(404).send('ID não encontrado no arquivo Data.json.');
    }
  } else {
    res.status(500).send('Erro ao ler o arquivo Data.json.');
  }
});



app.post('/edit/:id', (req, res) => {
  const { id } = req.params;
  const { url_bot, cliente, pageName } = req.body;

  // Verifique se a página com o ID especificado existe
  const folderPath = `./public/Pages/${id}`;
  if (fs.existsSync(folderPath)) {
    // Crie o conteúdo HTML com base no modelo fornecido
    const htmlContent = `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${pageName}</title>
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
    <iframe id="meuIframe" src="${url_bot}"></iframe>
    <script>
    document.addEventListener("DOMContentLoaded", function() {
      var iframe = document.getElementById("meuIframe");
    
      // Adiciona um ouvinte de mensagem para ouvir as mensagens do iframe
      window.addEventListener("message", function(event) {
        // Verifica se a mensagem é do tipo "urlChange"
        if (event.data.type === "urlChange") {
          // Obtém a nova URL do evento
          var newURL = event.data.url;
          
          // Redireciona a página principal para a nova URL
          window.location.href = newURL;
        }
      });
    });
    </script>
      </body>
      </html>`;

    // Salve o conteúdo HTML no arquivo index.html
    const indexPath = `${folderPath}/index.html`;
    fs.writeFileSync(indexPath, htmlContent);

    // Atualize o cliente e o status no arquivo Data.json
    const databasePath = './Data.json';
    if (fs.existsSync(databasePath)) {
      const rawData = fs.readFileSync(databasePath);
      let database = JSON.parse(rawData);

      const pageData = database.find(item => item.randomFolderName === id);
      if (pageData) {
        pageData.status = "Ativado";
        pageData.url_bot = url_bot; // Atualiza a URL do bot
        pageData.client = cliente; // Atualiza o cliente
        pageData.pageName = pageName; // Atualiza o nome da página

        fs.writeFileSync(databasePath, JSON.stringify(database));

        res.status(200).send('Página Editada com Sucesso');
        return;
      }
    }

    res.status(500).send('Erro ao atualizar a página.');
    console.log("Erro Au atulizar")
  } else {
    res.status(404).send('Página não encontrada.');
  }
});




app.post('/login', async (req, res) => {
  const { Name, Pass } = req.body;

  try {
    const response = await axios.post('http://localhost:31313/user', {
      Name,
      Pass
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const responseData = response.data;

    // Verifique se o StatusClient é "Ativo"
    if (responseData.StatusClient === 'Ativo') {
      // Se for "Ativo", você pode prosseguir com a lógica de login
      res.json({
        Mensagem: 'Usuário autenticado com sucesso',
        token: responseData.token,
        StatusClient: 'Ativo'
      });
    } else {
      // Caso contrário, retorne uma mensagem de erro
      res.status(401).json({ Mensagem: 'Erro ao logar: Status do cliente não é Ativo' });
    }
  } catch (error) {
    console.error('Erro ao fazer a requisição para /login:', error.response.data );
    res.status(500).json({ Mensagem: 'Erro ao logar' });
  }
});


const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});