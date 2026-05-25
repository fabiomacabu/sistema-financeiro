const sqlite3 = require('sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'dados.sqlite');
const db = new sqlite3.Database(dbPath);

// Inicializa tabelas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS empresas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cnpj TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      cargo TEXT,
      salario REAL NOT NULL,
      empresaId TEXT NOT NULL,
      FOREIGN KEY(empresaId) REFERENCES empresas(id) ON DELETE RESTRICT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS planosContas (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('Benefício', 'Desconto'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id TEXT PRIMARY KEY,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      data TEXT NOT NULL,
      empresaId TEXT NOT NULL,
      funcionarioId TEXT NOT NULL,
      planoContaId TEXT NOT NULL,
      FOREIGN KEY(empresaId) REFERENCES empresas(id),
      FOREIGN KEY(funcionarioId) REFERENCES funcionarios(id),
      FOREIGN KEY(planoContaId) REFERENCES planosContas(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id TEXT PRIMARY KEY,
      funcionarioId TEXT NOT NULL,
      mesAno TEXT NOT NULL,
      dataPagamento TEXT NOT NULL,
      valor REAL NOT NULL,
      FOREIGN KEY(funcionarioId) REFERENCES funcionarios(id),
      UNIQUE(funcionarioId, mesAno)
    )
  `);
});

module.exports = db;