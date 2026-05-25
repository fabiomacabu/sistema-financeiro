const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Banco de dados
const dbPath = path.join(__dirname, 'dados.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Tabelas existentes (com CASCADE)
  db.run(`CREATE TABLE IF NOT EXISTS empresas ( id TEXT PRIMARY KEY, nome TEXT NOT NULL, cnpj TEXT )`);
  db.run(`CREATE TABLE IF NOT EXISTS funcionarios ( id TEXT PRIMARY KEY, nome TEXT NOT NULL, cargo TEXT, salario REAL NOT NULL, empresaId TEXT NOT NULL, FOREIGN KEY(empresaId) REFERENCES empresas(id) ON DELETE CASCADE )`);
  db.run(`CREATE TABLE IF NOT EXISTS planosContas ( id TEXT PRIMARY KEY, nome TEXT NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN ('Benefício', 'Desconto')) )`);
  db.run(`CREATE TABLE IF NOT EXISTS lancamentos ( id TEXT PRIMARY KEY, descricao TEXT NOT NULL, valor REAL NOT NULL, data TEXT NOT NULL, empresaId TEXT NOT NULL, funcionarioId TEXT NOT NULL, planoContaId TEXT NOT NULL, recorrente INTEGER DEFAULT 0, FOREIGN KEY(empresaId) REFERENCES empresas(id) ON DELETE CASCADE, FOREIGN KEY(funcionarioId) REFERENCES funcionarios(id) ON DELETE CASCADE, FOREIGN KEY(planoContaId) REFERENCES planosContas(id) ON DELETE CASCADE )`);
  db.run(`CREATE TABLE IF NOT EXISTS pagamentos ( id TEXT PRIMARY KEY, funcionarioId TEXT NOT NULL, mesAno TEXT NOT NULL, dataPagamento TEXT NOT NULL, valor REAL NOT NULL, FOREIGN KEY(funcionarioId) REFERENCES funcionarios(id) ON DELETE CASCADE, UNIQUE(funcionarioId, mesAno) )`);
});

function getNextId(table, callback) {
  db.get(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 1`, (err, row) => {
    if (err || !row) callback('0001');
    else {
      const lastId = parseInt(row.id, 10);
      const nextId = (lastId + 1).toString().padStart(4, '0');
      callback(nextId);
    }
  });
}

// ===================== CRUD EMPRESAS =====================
app.get('/api/empresas', (req, res) => {
  db.all('SELECT * FROM empresas ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.post('/api/empresas', (req, res) => {
  const { nome, cnpj } = req.body;
  getNextId('empresas', (id) => {
    db.run('INSERT INTO empresas (id, nome, cnpj) VALUES (?, ?, ?)', [id, nome, cnpj], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, nome, cnpj });
    });
  });
});
app.put('/api/empresas/:id', (req, res) => {
  const { id } = req.params;
  const { nome, cnpj } = req.body;
  db.run('UPDATE empresas SET nome = ?, cnpj = ? WHERE id = ?', [nome, cnpj, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, nome, cnpj });
  });
});
app.delete('/api/empresas/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM empresas WHERE id = ?', [id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.status(204).send();
  });
});

// ===================== CRUD FUNCIONÁRIOS =====================
app.get('/api/funcionarios', (req, res) => {
  db.all('SELECT * FROM funcionarios ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.post('/api/funcionarios', (req, res) => {
  const { nome, cargo, salario, empresaId } = req.body;
  getNextId('funcionarios', (id) => {
    db.run('INSERT INTO funcionarios (id, nome, cargo, salario, empresaId) VALUES (?, ?, ?, ?, ?)', [id, nome, cargo, salario, empresaId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, nome, cargo, salario, empresaId });
    });
  });
});
app.put('/api/funcionarios/:id', (req, res) => {
  const { id } = req.params;
  const { nome, cargo, salario, empresaId } = req.body;
  db.run('UPDATE funcionarios SET nome = ?, cargo = ?, salario = ?, empresaId = ? WHERE id = ?', [nome, cargo, salario, empresaId, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, nome, cargo, salario, empresaId });
  });
});
app.delete('/api/funcionarios/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM funcionarios WHERE id = ?', [id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.status(204).send();
  });
});

// ===================== CRUD PLANOS DE CONTAS =====================
app.get('/api/planosContas', (req, res) => {
  db.all('SELECT * FROM planosContas ORDER BY id', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.post('/api/planosContas', (req, res) => {
  const { nome, tipo } = req.body;
  getNextId('planosContas', (id) => {
    db.run('INSERT INTO planosContas (id, nome, tipo) VALUES (?, ?, ?)', [id, nome, tipo], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, nome, tipo });
    });
  });
});
app.put('/api/planosContas/:id', (req, res) => {
  const { id } = req.params;
  const { nome, tipo } = req.body;
  db.run('UPDATE planosContas SET nome = ?, tipo = ? WHERE id = ?', [nome, tipo, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id, nome, tipo });
  });
});
app.delete('/api/planosContas/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM planosContas WHERE id = ?', [id], function(err) {
    if (err) return res.status(400).json({ error: err.message });
    res.status(204).send();
  });
});

// ===================== CRUD LANÇAMENTOS (COM RECORRENTE) =====================
app.get('/api/lancamentos', (req, res) => {
  db.all('SELECT * FROM lancamentos ORDER BY data DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.post('/api/lancamentos', (req, res) => {
  const { descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente } = req.body;
  getNextId('lancamentos', (id) => {
    db.run('INSERT INTO lancamentos (id, descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente ? 1 : 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id, descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente });
      });
  });
});
app.put('/api/lancamentos/:id', (req, res) => {
  const { id } = req.params;
  const { descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente } = req.body;
  db.run('UPDATE lancamentos SET descricao = ?, valor = ?, data = ?, empresaId = ?, funcionarioId = ?, planoContaId = ?, recorrente = ? WHERE id = ?',
    [descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente ? 1 : 0, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id, descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente });
    });
});
app.delete('/api/lancamentos/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM lancamentos WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(204).send();
  });
});

// ===================== CRUD PAGAMENTOS =====================
app.get('/api/pagamentos', (req, res) => {
  db.all('SELECT * FROM pagamentos', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});
app.post('/api/pagamentos', (req, res) => {
  const { funcionarioId, mesAno, dataPagamento, valor } = req.body;
  getNextId('pagamentos', (id) => {
    db.run('INSERT INTO pagamentos (id, funcionarioId, mesAno, dataPagamento, valor) VALUES (?, ?, ?, ?, ?)', [id, funcionarioId, mesAno, dataPagamento, valor], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id, funcionarioId, mesAno, dataPagamento, valor });
    });
  });
});
app.delete('/api/pagamentos/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM pagamentos WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(204).send();
  });
});

// ===================== GERAR LANÇAMENTOS RECORRENTES =====================
app.post('/api/gerarRecorrentes', (req, res) => {
  const { dataReferencia } = req.body; // data no formato YYYY-MM (ex: 2026-05)
  if (!dataReferencia) return res.status(400).json({ error: 'Data referência não fornecida' });
  
  db.all('SELECT * FROM lancamentos WHERE recorrente = 1', (err, recorrentes) => {
    if (err) return res.status(500).json({ error: err.message });
    let criados = 0;
    let promises = [];
    recorrentes.forEach(lanc => {
      // Verifica se já existe lançamento para este funcionário e mesmo plano no mês referência
      const mesAno = dataReferencia; // ex: "2026-05"
      const dataInicio = `${mesAno}-01`;
      db.get('SELECT id FROM lancamentos WHERE funcionarioId = ? AND planoContaId = ? AND data LIKE ? AND recorrente = 0', 
        [lanc.funcionarioId, lanc.planoContaId, `${mesAno}%`], (err, existente) => {
          if (!existente) {
            // Cria novo lançamento
            getNextId('lancamentos', (novoId) => {
              db.run('INSERT INTO lancamentos (id, descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
                [novoId, lanc.descricao, lanc.valor, dataInicio, lanc.empresaId, lanc.funcionarioId, lanc.planoContaId], function(err) {
                  if (!err) criados++;
                });
            });
          }
        });
    });
    setTimeout(() => {
      res.json({ message: `${criados} lançamentos recorrentes gerados para ${mesAno}` });
    }, 500);
  });
});

// ===================== BACKUP E RESTAURAÇÃO =====================
app.get('/api/backup', (req, res) => {
  db.all('SELECT * FROM empresas', (err, empresas) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all('SELECT * FROM funcionarios', (err2, funcionarios) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.all('SELECT * FROM planosContas', (err3, planos) => {
        if (err3) return res.status(500).json({ error: err3.message });
        db.all('SELECT * FROM lancamentos', (err4, lancamentos) => {
          if (err4) return res.status(500).json({ error: err4.message });
          db.all('SELECT * FROM pagamentos', (err5, pagamentos) => {
            if (err5) return res.status(500).json({ error: err5.message });
            const backup = { empresas, funcionarios, planosContas, lancamentos, pagamentos };
            res.json(backup);
          });
        });
      });
    });
  });
});

app.post('/api/restore', (req, res) => {
  const { empresas, funcionarios, planosContas, lancamentos, pagamentos } = req.body;
  if (!empresas || !funcionarios || !planosContas || !lancamentos || !pagamentos) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }
  db.serialize(() => {
    db.run('DELETE FROM lancamentos');
    db.run('DELETE FROM pagamentos');
    db.run('DELETE FROM funcionarios');
    db.run('DELETE FROM planosContas');
    db.run('DELETE FROM empresas');
    // Inserir empresas
    empresas.forEach(emp => {
      db.run('INSERT INTO empresas (id, nome, cnpj) VALUES (?, ?, ?)', [emp.id, emp.nome, emp.cnpj]);
    });
    funcionarios.forEach(func => {
      db.run('INSERT INTO funcionarios (id, nome, cargo, salario, empresaId) VALUES (?, ?, ?, ?, ?)', [func.id, func.nome, func.cargo, func.salario, func.empresaId]);
    });
    planosContas.forEach(plano => {
      db.run('INSERT INTO planosContas (id, nome, tipo) VALUES (?, ?, ?)', [plano.id, plano.nome, plano.tipo]);
    });
    lancamentos.forEach(lanc => {
      db.run('INSERT INTO lancamentos (id, descricao, valor, data, empresaId, funcionarioId, planoContaId, recorrente) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [lanc.id, lanc.descricao, lanc.valor, lanc.data, lanc.empresaId, lanc.funcionarioId, lanc.planoContaId, lanc.recorrente || 0]);
    });
    pagamentos.forEach(pag => {
      db.run('INSERT INTO pagamentos (id, funcionarioId, mesAno, dataPagamento, valor) VALUES (?, ?, ?, ?, ?)', [pag.id, pag.funcionarioId, pag.mesAno, pag.dataPagamento, pag.valor]);
    });
    res.json({ message: 'Restauração concluída com sucesso!' });
  });
});

// ===================== RESET =====================
app.post('/api/reset', (req, res) => {
  db.serialize(() => {
    db.run('DELETE FROM lancamentos');
    db.run('DELETE FROM pagamentos');
    db.run('DELETE FROM funcionarios');
    db.run('DELETE FROM planosContas');
    db.run('DELETE FROM empresas');
    res.json({ message: 'Todos os dados foram limpos!' });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});