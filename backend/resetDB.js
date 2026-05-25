const fs = require('fs');
const path = require('path');

const dadosPath = path.join(__dirname, 'dados.sqlite');
if (fs.existsSync(dadosPath)) {
  fs.unlinkSync(dadosPath);
  console.log('Banco de dados removido com sucesso!');
} else {
  console.log('Arquivo dados.sqlite não encontrado.');
}