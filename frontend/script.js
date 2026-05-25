// ===================== CONFIGURAÇÃO =====================
const API_URL = '/api';

let empresas = [];
let funcionarios = [];
let planosContas = [];
let lancamentos = [];
let pagamentos = [];

let filtroEmpresaAtual = '';
let filtroFuncionarioAtual = '';
let filtroTipoMovimentoAtual = '';
let filtroDataInicio = '';
let filtroDataFim = '';
let filtroValorMin = '';
let filtroValorMax = '';

let editandoEmpresa = false;
let editandoFuncionario = false;
let editandoPlano = false;
let editandoLancamento = false;

let chartBeneficiosDescontos = null;
let chartEvolucaoMensal = null;

function formatarMoeda(valor) {
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarData(dataISO) {
    if (!dataISO) return '';
    const [a, m, d] = dataISO.split('-');
    return `${d}/${m}/${a}`;
}

async function fetchAPI(endpoint, options = {}) {
    const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!res.ok && res.status !== 204 && res.status !== 404) {
        let errorMsg;
        try { const error = await res.json(); errorMsg = error.error || 'Erro na requisição'; }
        catch { errorMsg = `Erro ${res.status}: ${res.statusText}`; }
        throw new Error(errorMsg);
    }
    if (res.status === 204 || res.status === 404) return null;
    return res.json();
}

async function carregarDados() {
    try {
        [empresas, funcionarios, planosContas, lancamentos, pagamentos] = await Promise.all([
            fetchAPI('/empresas'),
            fetchAPI('/funcionarios'),
            fetchAPI('/planosContas'),
            fetchAPI('/lancamentos'),
            fetchAPI('/pagamentos')
        ]);
        empresas = empresas || [];
        funcionarios = funcionarios || [];
        planosContas = planosContas || [];
        lancamentos = lancamentos || [];
        pagamentos = pagamentos || [];
        await processarRecorrentes();
        atualizarGraficos();
        console.log('Dados carregados');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao conectar com o servidor.');
    }
}

async function processarRecorrentes() {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const recorrentesPendentes = lancamentos.filter(l => l.recorrente && !l.data.startsWith(mesAtual));
    for (const l of recorrentesPendentes) {
        const novaData = `${mesAtual}-${l.data.split('-')[2]}`;
        const jaExiste = lancamentos.some(ex => ex.funcionarioId === l.funcionarioId && ex.planoContaId === l.planoContaId && ex.data === novaData);
        if (!jaExiste) {
            await adicionarLancamento({
                descricao: l.descricao,
                valor: l.valor,
                data: novaData,
                funcionarioId: l.funcionarioId,
                planoContaId: l.planoContaId,
                recorrente: true
            });
        }
    }
}

async function adicionarEmpresa(dados) {
    await fetchAPI('/empresas', { method: 'POST', body: JSON.stringify(dados) });
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    aplicarFiltrosAtuais();
    atualizarFiltroFuncionarios();
}
async function atualizarEmpresa(id, dados) {
    await fetchAPI(`/empresas/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    aplicarFiltrosAtuais();
    atualizarFiltroFuncionarios();
}
async function excluirEmpresa(id) {
    try {
        await fetchAPI(`/empresas/${id}`, { method: 'DELETE' });
        await carregarDados();
        renderizarTodasTabelas();
        popularDropdownsGlobais();
        aplicarFiltrosAtuais();
        atualizarFiltroFuncionarios();
        return true;
    } catch (error) { alert(error.message); return false; }
}
async function adicionarFuncionario(dados) {
    await fetchAPI('/funcionarios', { method: 'POST', body: JSON.stringify(dados) });
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    aplicarFiltrosAtuais();
    atualizarFiltroFuncionarios();
}
async function atualizarFuncionario(id, dados) {
    await fetchAPI(`/funcionarios/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    aplicarFiltrosAtuais();
    atualizarFiltroFuncionarios();
}
async function excluirFuncionario(id) {
    try {
        await fetchAPI(`/funcionarios/${id}`, { method: 'DELETE' });
        await carregarDados();
        renderizarTodasTabelas();
        popularDropdownsGlobais();
        aplicarFiltrosAtuais();
        atualizarFiltroFuncionarios();
        return true;
    } catch (error) { alert(error.message); return false; }
}
async function adicionarPlanoConta(dados) {
    await fetchAPI('/planosContas', { method: 'POST', body: JSON.stringify(dados) });
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    aplicarFiltrosAtuais();
}
async function atualizarPlanoConta(id, dados) {
    await fetchAPI(`/planosContas/${id}`, { method: 'PUT', body: JSON.stringify(dados) });
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    aplicarFiltrosAtuais();
}
async function excluirPlanoConta(id) {
    try {
        await fetchAPI(`/planosContas/${id}`, { method: 'DELETE' });
        await carregarDados();
        renderizarTodasTabelas();
        popularDropdownsGlobais();
        aplicarFiltrosAtuais();
        return true;
    } catch (error) { alert(error.message); return false; }
}
async function adicionarLancamento(dados) {
    const func = funcionarios.find(f => f.id === dados.funcionarioId);
    if (!func) throw new Error('Funcionário não encontrado');
    const completo = { ...dados, empresaId: func.empresaId };
    await fetchAPI('/lancamentos', { method: 'POST', body: JSON.stringify(completo) });
    await carregarDados();
    aplicarFiltrosAtuais();
}
async function atualizarLancamento(id, dados) {
    const func = funcionarios.find(f => f.id === dados.funcionarioId);
    if (!func) throw new Error('Funcionário não encontrado');
    const completo = { ...dados, empresaId: func.empresaId };
    await fetchAPI(`/lancamentos/${id}`, { method: 'PUT', body: JSON.stringify(completo) });
    await carregarDados();
    aplicarFiltrosAtuais();
}
async function excluirLancamento(id) {
    await fetchAPI(`/lancamentos/${id}`, { method: 'DELETE' });
    await carregarDados();
    aplicarFiltrosAtuais();
}
async function registrarPagamento(funcionarioId, mesAno, dataPagamento, valor, planoContaId) {
    const jaExiste = pagamentos.some(p => p.funcionarioId === funcionarioId && p.mesAno === mesAno);
    if (jaExiste) { alert("Pagamento já registrado."); return false; }
    await fetchAPI('/pagamentos', { method: 'POST', body: JSON.stringify({ funcionarioId, mesAno, dataPagamento, valor }) });
    const func = funcionarios.find(f => f.id === funcionarioId);
    if (func && planoContaId) {
        const descricao = `Salário pago - ${func.nome} - ${mesAno.replace('-', '/')}`;
        await adicionarLancamento({ descricao, valor, data: dataPagamento, funcionarioId, planoContaId, recorrente: false });
    }
    await carregarDados();
    aplicarFiltrosAtuais();
    return true;
}
async function cancelarPagamento(funcionarioId, mesAno) {
    try {
        const pagamento = pagamentos.find(p => p.funcionarioId === funcionarioId && p.mesAno === mesAno);
        if (!pagamento) { alert('Pagamento não encontrado.'); return; }
        await fetchAPI(`/pagamentos/${pagamento.id}`, { method: 'DELETE' });
        const lancSalario = lancamentos.find(l => 
            l.funcionarioId === funcionarioId && 
            l.data.startsWith(mesAno) && 
            l.descricao.includes('Salário pago')
        );
        if (lancSalario) {
            await fetchAPI(`/lancamentos/${lancSalario.id}`, { method: 'DELETE' });
        }
        await carregarDados();
        const empresa = document.getElementById('folhaEmpresa').value;
        const funcionario = document.getElementById('folhaFuncionario').value;
        renderizarFolha(empresa, funcionario, mesAno);
        alert('Pagamento cancelado com sucesso!');
    } catch (error) {
        console.error('Erro ao cancelar pagamento:', error);
        alert('Erro ao cancelar pagamento.');
    }
}

async function fazerBackup() {
    const dados = { empresas, funcionarios, planosContas, lancamentos, pagamentos };
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_sistema_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Backup exportado com sucesso!');
}
async function restaurarBackup(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const dados = JSON.parse(e.target.result);
            if (!dados.empresas || !dados.funcionarios) throw new Error('Arquivo inválido');
            await fetchAPI('/reset', { method: 'POST' });
            for (const emp of dados.empresas) {
                await fetchAPI('/empresas', { method: 'POST', body: JSON.stringify({ nome: emp.nome, cnpj: emp.cnpj }) });
            }
            for (const func of dados.funcionarios) {
                await fetchAPI('/funcionarios', { method: 'POST', body: JSON.stringify({ nome: func.nome, cargo: func.cargo, salario: func.salario, empresaId: func.empresaId }) });
            }
            for (const plano of dados.planosContas) {
                await fetchAPI('/planosContas', { method: 'POST', body: JSON.stringify({ nome: plano.nome, tipo: plano.tipo }) });
            }
            for (const lanc of dados.lancamentos) {
                await fetchAPI('/lancamentos', { method: 'POST', body: JSON.stringify({ descricao: lanc.descricao, valor: lanc.valor, data: lanc.data, empresaId: lanc.empresaId, funcionarioId: lanc.funcionarioId, planoContaId: lanc.planoContaId }) });
            }
            for (const pag of dados.pagamentos) {
                await fetchAPI('/pagamentos', { method: 'POST', body: JSON.stringify({ funcionarioId: pag.funcionarioId, mesAno: pag.mesAno, dataPagamento: pag.dataPagamento, valor: pag.valor }) });
            }
            await carregarDados();
            renderizarTodasTabelas();
            popularDropdownsGlobais();
            aplicarFiltrosAtuais();
            atualizarFiltroFuncionarios();
            alert('Backup restaurado com sucesso!');
        } catch (error) { alert('Erro ao restaurar backup: ' + error.message); }
    };
    reader.readAsText(file);
}

async function limparDadosSeletivos(limparEmpresas, limparFuncionarios, limparPlanos, limparLancamentos, limparPagamentos) {
    try {
        if (limparLancamentos) { for (const l of lancamentos) try { await fetchAPI(`/lancamentos/${l.id}`, { method: 'DELETE' }); } catch(e) {} }
        if (limparPagamentos) { for (const p of pagamentos) try { await fetchAPI(`/pagamentos/${p.id}`, { method: 'DELETE' }); } catch(e) {} }
        if (limparFuncionarios) { for (const f of funcionarios) try { await fetchAPI(`/funcionarios/${f.id}`, { method: 'DELETE' }); } catch(e) {} }
        if (limparPlanos) { for (const p of planosContas) try { await fetchAPI(`/planosContas/${p.id}`, { method: 'DELETE' }); } catch(e) {} }
        if (limparEmpresas) { for (const e of empresas) try { await fetchAPI(`/empresas/${e.id}`, { method: 'DELETE' }); } catch(e) {} }
        await carregarDados();
        renderizarTodasTabelas();
        popularDropdownsGlobais();
        aplicarFiltrosAtuais();
        atualizarFiltroFuncionarios();
        alert('Dados selecionados removidos!');
    } catch (error) { console.error('Erro na limpeza:', error); alert('Erro ao limpar dados: ' + error.message); }
}

function atualizarGraficos() {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const lancamentosMes = lancamentos.filter(l => l.data.startsWith(mesAtual));
    let totalBeneficios = 0, totalDescontos = 0;
    lancamentosMes.forEach(l => {
        const plano = planosContas.find(p => p.id === l.planoContaId);
        if (plano) {
            if (plano.tipo === 'Benefício') totalBeneficios += l.valor;
            else if (plano.tipo === 'Desconto') totalDescontos += l.valor;
        }
    });
    const ctx1 = document.getElementById('chartBeneficiosDescontos');
    if (ctx1) {
        if (chartBeneficiosDescontos) chartBeneficiosDescontos.destroy();
        chartBeneficiosDescontos = new Chart(ctx1, {
            type: 'bar',
            data: { labels: ['Benefícios (+)', 'Descontos (-)'], datasets: [{ label: 'Valores (R$)', data: [totalBeneficios, totalDescontos], backgroundColor: ['#2b6cb0', '#e53e3e'] }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Benefícios vs Descontos - Mês Atual' } } }
        });
    }
    const meses = [];
    const beneficiosMensal = [];
    const descontosMensal = [];
    for (let i = 5; i >= 0; i--) {
        const data = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const mes = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        meses.push(`${data.getMonth()+1}/${data.getFullYear()}`);
        const lancs = lancamentos.filter(l => l.data.startsWith(mes));
        let ben = 0, desc = 0;
        lancs.forEach(l => {
            const plano = planosContas.find(p => p.id === l.planoContaId);
            if (plano) {
                if (plano.tipo === 'Benefício') ben += l.valor;
                else if (plano.tipo === 'Desconto') desc += l.valor;
            }
        });
        beneficiosMensal.push(ben);
        descontosMensal.push(desc);
    }
    const ctx2 = document.getElementById('chartEvolucaoMensal');
    if (ctx2) {
        if (chartEvolucaoMensal) chartEvolucaoMensal.destroy();
        chartEvolucaoMensal = new Chart(ctx2, {
            type: 'line',
            data: { labels: meses, datasets: [{ label: 'Benefícios', data: beneficiosMensal, borderColor: '#2b6cb0', fill: false }, { label: 'Descontos', data: descontosMensal, borderColor: '#e53e3e', fill: false }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { title: { display: true, text: 'Evolução Mensal (últimos 6 meses)' } } }
        });
    }
}

function renderizarTabelaEmpresas() {
    const tbody = document.querySelector('#tabelaEmpresas tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    empresas.forEach(emp => {
        const tr = document.createElement('tr');
        const tdId = document.createElement('td'); tdId.textContent = emp.id; tr.appendChild(tdId);
        const tdNome = document.createElement('td'); tdNome.textContent = emp.nome; tr.appendChild(tdNome);
        const tdCnpj = document.createElement('td'); tdCnpj.textContent = emp.cnpj || '-'; tr.appendChild(tdCnpj);
        const tdAcoes = document.createElement('td'); tdAcoes.innerHTML = `<button class="action-btn edit-btn" data-id="${emp.id}" data-tipo="empresa">✏️</button><button class="action-btn delete-btn" data-id="${emp.id}" data-tipo="empresa">🗑️</button>`; tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });
    attachEditDeleteEvents('#tabelaEmpresas', 'empresa');
}
function renderizarTabelaFuncionarios() {
    const tbody = document.querySelector('#tabelaFuncionarios tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    funcionarios.forEach(func => {
        const empresaNome = empresas.find(e => e.id === func.empresaId)?.nome || '-';
        const tr = document.createElement('tr');
        const tdId = document.createElement('td'); tdId.textContent = func.id; tr.appendChild(tdId);
        const tdNome = document.createElement('td'); tdNome.textContent = func.nome; tr.appendChild(tdNome);
        const tdCargo = document.createElement('td'); tdCargo.textContent = func.cargo || '-'; tr.appendChild(tdCargo);
        const tdSalario = document.createElement('td'); tdSalario.textContent = formatarMoeda(func.salario || 0); tr.appendChild(tdSalario);
        const tdEmpresa = document.createElement('td'); tdEmpresa.textContent = empresaNome; tr.appendChild(tdEmpresa);
        const tdAcoes = document.createElement('td'); tdAcoes.innerHTML = `<button class="action-btn edit-btn" data-id="${func.id}" data-tipo="funcionario">✏️</button><button class="action-btn delete-btn" data-id="${func.id}" data-tipo="funcionario">🗑️</button>`; tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });
    attachEditDeleteEvents('#tabelaFuncionarios', 'funcionario');
}
function renderizarTabelaPlanos() {
    const tbody = document.querySelector('#tabelaPlanos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    planosContas.forEach(plano => {
        const tr = document.createElement('tr');
        const tdId = document.createElement('td'); tdId.textContent = plano.id; tr.appendChild(tdId);
        const tdNome = document.createElement('td'); tdNome.textContent = plano.nome; tr.appendChild(tdNome);
        const tdTipo = document.createElement('td'); tdTipo.textContent = plano.tipo; tr.appendChild(tdTipo);
        const tdAcoes = document.createElement('td'); tdAcoes.innerHTML = `<button class="action-btn edit-btn" data-id="${plano.id}" data-tipo="plano">✏️</button><button class="action-btn delete-btn" data-id="${plano.id}" data-tipo="plano">🗑️</button>`; tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });
    attachEditDeleteEvents('#tabelaPlanos', 'plano');
}
function renderizarTabelaLancamentos() {
    const tbody = document.querySelector('#tabelaLancamentos tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    let filtrados = lancamentos.filter(l => {
        if (filtroEmpresaAtual && l.empresaId !== filtroEmpresaAtual) return false;
        if (filtroFuncionarioAtual && l.funcionarioId !== filtroFuncionarioAtual) return false;
        if (filtroTipoMovimentoAtual) {
            const plano = planosContas.find(p => p.id === l.planoContaId);
            if (!plano || plano.tipo !== filtroTipoMovimentoAtual) return false;
        }
        if (filtroDataInicio && l.data < filtroDataInicio) return false;
        if (filtroDataFim && l.data > filtroDataFim) return false;
        if (filtroValorMin && l.valor < parseFloat(filtroValorMin)) return false;
        if (filtroValorMax && l.valor > parseFloat(filtroValorMax)) return false;
        return true;
    });
    filtrados.forEach(lanc => {
        const empresaNome = empresas.find(e => e.id === lanc.empresaId)?.nome || '-';
        const funcionarioNome = lanc.funcionarioId ? (funcionarios.find(f => f.id === lanc.funcionarioId)?.nome || '-') : 'Nenhum';
        const plano = planosContas.find(p => p.id === lanc.planoContaId);
        const planoNome = plano?.nome || '-';
        const tipoMov = plano?.tipo || '-';
        const valorClasse = tipoMov === 'Benefício' ? 'valor-positivo' : (tipoMov === 'Desconto' ? 'valor-negativo' : '');
        const tr = document.createElement('tr');
        const tdData = document.createElement('td'); tdData.textContent = formatarData(lanc.data); tr.appendChild(tdData);
        const tdDescricao = document.createElement('td'); tdDescricao.textContent = lanc.descricao; tr.appendChild(tdDescricao);
        const tdTipo = document.createElement('td'); tdTipo.textContent = tipoMov; tr.appendChild(tdTipo);
        const tdEmpresa = document.createElement('td'); tdEmpresa.textContent = empresaNome; tr.appendChild(tdEmpresa);
        const tdFuncionario = document.createElement('td'); tdFuncionario.textContent = funcionarioNome; tr.appendChild(tdFuncionario);
        const tdPlano = document.createElement('td'); tdPlano.textContent = planoNome; tr.appendChild(tdPlano);
        const tdValor = document.createElement('td'); tdValor.className = valorClasse; tdValor.textContent = formatarMoeda(lanc.valor); tr.appendChild(tdValor);
        const tdAcoes = document.createElement('td'); tdAcoes.innerHTML = `<button class="action-btn edit-btn" data-id="${lanc.id}" data-tipo="lancamento">✏️</button><button class="action-btn delete-btn" data-id="${lanc.id}" data-tipo="lancamento">🗑️</button>`; tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });
    attachEditDeleteEvents('#tabelaLancamentos', 'lancamento');
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const lancamentosMes = lancamentos.filter(l => l.data.startsWith(mesAtual));
    let totalBeneficios = 0, totalDescontos = 0;
    lancamentosMes.forEach(l => { const plano = planosContas.find(p => p.id === l.planoContaId); if (plano) { if (plano.tipo === 'Benefício') totalBeneficios += l.valor; else if (plano.tipo === 'Desconto') totalDescontos += l.valor; } });
    document.getElementById('totalBeneficios').innerText = formatarMoeda(totalBeneficios);
    document.getElementById('totalDescontos').innerText = formatarMoeda(totalDescontos);
    document.getElementById('totalLiquido').innerText = formatarMoeda(totalBeneficios - totalDescontos);
    atualizarGraficos();
}
function attachEditDeleteEvents(tableSelector, tipo) {
    document.querySelectorAll(`${tableSelector} .edit-btn`).forEach(btn => {
        btn.removeEventListener('click', handleEdit);
        btn.addEventListener('click', handleEdit);
    });
    document.querySelectorAll(`${tableSelector} .delete-btn`).forEach(btn => {
        btn.removeEventListener('click', handleDelete);
        btn.addEventListener('click', handleDelete);
    });
    function handleEdit(e) { const id = e.currentTarget.dataset.id; if (tipo === 'empresa') abrirModalEditarEmpresa(id); else if (tipo === 'funcionario') abrirModalEditarFuncionario(id); else if (tipo === 'plano') abrirModalEditarPlano(id); else if (tipo === 'lancamento') abrirModalEditarLancamento(id); }
    function handleDelete(e) { const id = e.currentTarget.dataset.id; if (confirm('Excluir?')) { if (tipo === 'empresa') excluirEmpresa(id); else if (tipo === 'funcionario') excluirFuncionario(id); else if (tipo === 'plano') excluirPlanoConta(id); else if (tipo === 'lancamento') excluirLancamento(id); } }
}

function renderizarFolha(empresaId, funcionarioId, mesAno) {
    const tbody = document.querySelector('#tabelaFolha tbody');
    if (!tbody) return;
    let funcs = [];
    if (funcionarioId) { const f = funcionarios.find(f => f.id === funcionarioId); if (f && (!empresaId || f.empresaId === empresaId)) funcs = [f]; }
    else { funcs = empresaId ? funcionarios.filter(f => f.empresaId === empresaId) : funcionarios; }
    tbody.innerHTML = '';
    funcs.forEach(func => {
        const salarioBase = func.salario || 0;
        const lancamentosMes = lancamentos.filter(l => l.funcionarioId === func.id && l.data.startsWith(mesAno));
        let totalBeneficios = 0, totalDescontos = 0;
        lancamentosMes.forEach(l => { const plano = planosContas.find(p => p.id === l.planoContaId); if (plano) { if (plano.tipo === 'Benefício') totalBeneficios += l.valor; else if (plano.tipo === 'Desconto') totalDescontos += l.valor; } });
        const valorPagar = salarioBase;
        const pagamentoExistente = pagamentos.find(p => p.funcionarioId === func.id && p.mesAno === mesAno);
        const status = pagamentoExistente ? 'Pago' : 'Pendente';
        const tr = document.createElement('tr');
        const tdNome = document.createElement('td'); tdNome.textContent = func.nome; tr.appendChild(tdNome);
        const tdEmpresa = document.createElement('td'); tdEmpresa.textContent = empresas.find(e => e.id === func.empresaId)?.nome || '-'; tr.appendChild(tdEmpresa);
        const tdSalario = document.createElement('td'); tdSalario.textContent = formatarMoeda(salarioBase); tr.appendChild(tdSalario);
        const tdBeneficios = document.createElement('td'); tdBeneficios.textContent = formatarMoeda(totalBeneficios); tr.appendChild(tdBeneficios);
        const tdDescontos = document.createElement('td'); tdDescontos.textContent = formatarMoeda(totalDescontos); tr.appendChild(tdDescontos);
        const tdTotal = document.createElement('td'); tdTotal.innerHTML = `<strong>${formatarMoeda(valorPagar)}</strong>`; tr.appendChild(tdTotal);
        const tdStatus = document.createElement('td'); tdStatus.innerHTML = `<span class="${status === 'Pago' ? 'status-pago' : 'status-pendente'}">${status}</span>`; tr.appendChild(tdStatus);
        const tdAcoes = document.createElement('td');
        if (status === 'Pendente' && valorPagar > 0) { const btn = document.createElement('button'); btn.textContent = 'Pagar'; btn.className = 'btn-success btn-pagar'; btn.dataset.id = func.id; btn.dataset.mesano = mesAno; btn.dataset.valor = valorPagar; tdAcoes.appendChild(btn); }
        else if (status === 'Pago') { const btn = document.createElement('button'); btn.textContent = 'Cancelar Pagamento'; btn.className = 'btn-cancelar'; btn.dataset.id = func.id; btn.dataset.mesano = mesAno; tdAcoes.appendChild(btn); }
        else { tdAcoes.textContent = '—'; }
        tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
    });
    document.querySelectorAll('.btn-pagar').forEach(btn => { btn.addEventListener('click', () => { const id = btn.dataset.id; const mes = btn.dataset.mesano; const valor = parseFloat(btn.dataset.valor); abrirModalPagamento(id, mes, valor); }); });
    document.querySelectorAll('.btn-cancelar').forEach(btn => { btn.addEventListener('click', async () => { const id = btn.dataset.id; const mes = btn.dataset.mesano; if (confirm(`Cancelar pagamento de ${funcionarios.find(f=>f.id===id)?.nome} para ${mes.replace('-','/')}?`)) await cancelarPagamento(id, mes); }); });
}

function gerarRelatorio(tipo, empresaId, funcionarioId, mesAno) {
    let filtrados = []; let titulo = '';
    if (tipo === 'geral') {
        filtrados = lancamentos;
        titulo = 'Todos os lançamentos';
    } else if (tipo === 'empresa' && empresaId) {
        filtrados = lancamentos.filter(l => l.empresaId === empresaId);
        titulo = `Empresa: ${empresas.find(e => e.id === empresaId)?.nome || '?'}`;
    } else if (tipo === 'funcionario' && funcionarioId) {
        filtrados = lancamentos.filter(l => l.funcionarioId === funcionarioId);
        titulo = `Funcionário: ${funcionarios.find(f => f.id === funcionarioId)?.nome || '?'}`;
    } else if (tipo === 'mensal' && mesAno) {
        filtrados = lancamentos.filter(l => l.data.startsWith(mesAno));
        titulo = `Mês/Ano: ${mesAno.replace('-', '/')}`;
    } else {
        alert('Selecione os filtros corretamente');
        return;
    }

    let totalBeneficios = 0, totalDescontos = 0;
    filtrados.forEach(l => {
        const plano = planosContas.find(p => p.id === l.planoContaId);
        if (plano) {
            if (plano.tipo === 'Benefício') totalBeneficios += l.valor;
            else if (plano.tipo === 'Desconto') totalDescontos += l.valor;
        }
    });
    const totalLiquido = totalBeneficios - totalDescontos;
    const dataGeracao = new Date().toLocaleString('pt-BR');

    let html = `
        <div class="excel-report">
            <div class="excel-header">
                <h2>📊 RELATÓRIO FINANCEIRO</h2>
                <div>${titulo}</div>
                <div class="excel-date">Gerado em: ${dataGeracao}</div>
            </div>
            <div class="excel-table-wrapper">
                <table class="excel-table">
                    <thead>
                        <tr>
                            <th>Data</th><th>Descrição</th><th>Tipo</th><th>Empresa</th><th>Funcionário</th><th>Plano</th><th>Valor (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    filtrados.forEach(l => {
        const plano = planosContas.find(p => p.id === l.planoContaId);
        const tipoMov = plano?.tipo || '-';
        const empresaNome = empresas.find(e => e.id === l.empresaId)?.nome || '-';
        const funcNome = funcionarios.find(f => f.id === l.funcionarioId)?.nome || '-';
        const valorClasse = tipoMov === 'Benefício' ? 'valor-positivo' : (tipoMov === 'Desconto' ? 'valor-negativo' : '');
        html += `
            <tr>
                <td>${formatarData(l.data)}</td>
                <td>${l.descricao}</td>
                <td>${tipoMov}</td>
                <td>${empresaNome}</td>
                <td>${funcNome}</td>
                <td>${plano?.nome || '-'}</td>
                <td class="${valorClasse}">${formatarMoeda(l.valor)}</td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                    <tfoot>
                        <tr class="excel-total-row">
                            <td colspan="6"><strong>Total Benefícios (+)</strong></td>
                            <td><strong>${formatarMoeda(totalBeneficios)}</strong></td>
                        </tr>
                        <tr class="excel-total-row">
                            <td colspan="6"><strong>Total Descontos (-)</strong></td>
                            <td><strong>${formatarMoeda(totalDescontos)}</strong></td>
                        </tr>
                        <tr class="excel-grand-total">
                            <td colspan="6"><strong>📌 SALDO LÍQUIDO</strong></td>
                            <td><strong>${formatarMoeda(totalLiquido)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="excel-footer">Sistema de Folha de Pagamento</div>
        </div>
    `;
    document.getElementById('relatorioContainer').innerHTML = html;
}
function imprimirPDF(elementoId) { const element = document.getElementById(elementoId); if (!element) return; html2pdf().set({ margin: 0.5, filename: 'relatorio_financeiro.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'a4', orientation: 'landscape' } }).from(element).save(); }
function aplicarFiltrosAtuais() { renderizarTabelaLancamentos(); }

function popularPlanoPagamento() {
    const select = document.getElementById('pagamentoPlanoContaId');
    if (!select) return;
    if (planosContas.length === 0) { select.innerHTML = '<option value="">Nenhum plano cadastrado.</option>'; select.disabled = true; }
    else { select.innerHTML = planosContas.map(p => `<option value="${p.id}">${p.nome} (${p.tipo})</option>`).join(''); select.disabled = false; const salarioPlano = planosContas.find(p => p.nome.toLowerCase().includes('salário')); if (salarioPlano) select.value = salarioPlano.id; }
}
function popularDropdownsGlobais() {
    const empresaOptions = '<option value="">Selecione</option>' + empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
    document.getElementById('funcionarioEmpresaId').innerHTML = empresaOptions;
    const selectFuncLanc = document.getElementById('lancamentoFuncionarioId');
    if (selectFuncLanc) selectFuncLanc.innerHTML = '<option value="">Selecione</option>' + funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    document.getElementById('lancamentoPlanoContaId').innerHTML = planosContas.map(p => `<option value="${p.id}">${p.nome} (${p.tipo})</option>`).join('');
    popularPlanoPagamento();
    const filtroEmp = document.getElementById('filtroEmpresa'); filtroEmp.innerHTML = '<option value="">Todas empresas</option>' + empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join(''); filtroEmp.value = filtroEmpresaAtual; filtroEmp.onchange = () => { filtroEmpresaAtual = filtroEmp.value; atualizarFiltroFuncionarios(); renderizarTabelaLancamentos(); };
    const filtroTipo = document.getElementById('filtroTipoMovimento'); filtroTipo.value = filtroTipoMovimentoAtual; filtroTipo.onchange = () => { filtroTipoMovimentoAtual = filtroTipo.value; renderizarTabelaLancamentos(); };
    const folhaEmpresa = document.getElementById('folhaEmpresa'); folhaEmpresa.innerHTML = '<option value="">Todas empresas</option>' + empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join(''); folhaEmpresa.onchange = () => atualizarFolhaFuncionarios(); atualizarFolhaFuncionarios();
    const relEmpresa = document.getElementById('relEmpresa'); relEmpresa.innerHTML = '<option value="">Selecione a empresa</option>' + empresas.map(e => `<option value="${e.id}">${e.nome}</option>`).join('');
    const relFuncionario = document.getElementById('relFuncionario'); relFuncionario.innerHTML = '<option value="">Selecione o funcionário</option>' + funcionarios.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
}
function atualizarFiltroFuncionarios() {
    const select = document.getElementById('filtroFuncionario');
    if (!select) return;
    const lista = filtroEmpresaAtual ? funcionarios.filter(f => f.empresaId === filtroEmpresaAtual) : funcionarios;
    select.innerHTML = '<option value="">Todos funcionários</option>' + lista.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
    select.value = filtroFuncionarioAtual;
    select.onchange = () => { filtroFuncionarioAtual = select.value; renderizarTabelaLancamentos(); };
}
function atualizarFolhaFuncionarios() {
    const empresaId = document.getElementById('folhaEmpresa').value;
    const selectFunc = document.getElementById('folhaFuncionario');
    if (!selectFunc) return;
    const lista = empresaId ? funcionarios.filter(f => f.empresaId === empresaId) : funcionarios;
    selectFunc.innerHTML = '<option value="">Todos funcionários</option>' + lista.map(f => `<option value="${f.id}">${f.nome}</option>`).join('');
}
function renderizarTodasTabelas() { renderizarTabelaEmpresas(); renderizarTabelaFuncionarios(); renderizarTabelaPlanos(); renderizarTabelaLancamentos(); }

function abrirModalNovaEmpresa() { editandoEmpresa=false; document.getElementById('modalEmpresaTitle').innerText='Nova Empresa'; document.getElementById('formEmpresa').reset(); document.getElementById('empresaId').value=''; document.getElementById('modalEmpresa').style.display='flex'; }
function abrirModalEditarEmpresa(id) { const emp=empresas.find(e=>e.id===id); if(!emp)return; editandoEmpresa=true; document.getElementById('modalEmpresaTitle').innerText='Editar Empresa'; document.getElementById('empresaId').value=emp.id; document.getElementById('empresaNome').value=emp.nome; document.getElementById('empresaCnpj').value=emp.cnpj||''; document.getElementById('modalEmpresa').style.display='flex'; }
function abrirModalNovoFuncionario() { editandoFuncionario=false; document.getElementById('modalFuncionarioTitle').innerText='Novo Funcionário'; document.getElementById('formFuncionario').reset(); document.getElementById('funcionarioId').value=''; document.getElementById('modalFuncionario').style.display='flex'; }
function abrirModalEditarFuncionario(id) { const func=funcionarios.find(f=>f.id===id); if(!func)return; editandoFuncionario=true; document.getElementById('modalFuncionarioTitle').innerText='Editar Funcionário'; document.getElementById('funcionarioId').value=func.id; document.getElementById('funcionarioNome').value=func.nome; document.getElementById('funcionarioCargo').value=func.cargo||''; document.getElementById('funcionarioSalario').value=func.salario; document.getElementById('funcionarioEmpresaId').value=func.empresaId; document.getElementById('modalFuncionario').style.display='flex'; }
function abrirModalNovaConta() { editandoPlano=false; document.getElementById('modalPlanoTitle').innerText='Nova Conta'; document.getElementById('formPlanoConta').reset(); document.getElementById('planoId').value=''; document.getElementById('modalPlanoConta').style.display='flex'; }
function abrirModalEditarPlano(id) { const plano=planosContas.find(p=>p.id===id); if(!plano)return; editandoPlano=true; document.getElementById('modalPlanoTitle').innerText='Editar Conta'; document.getElementById('planoId').value=plano.id; document.getElementById('planoNome').value=plano.nome; document.getElementById('planoTipo').value=plano.tipo; document.getElementById('modalPlanoConta').style.display='flex'; }
function abrirModalNovoLancamento() { editandoLancamento=false; document.getElementById('modalLancamentoTitle').innerText='Novo Lançamento'; document.getElementById('formLancamento').reset(); document.getElementById('lancamentoId').value=''; document.getElementById('lancamentoData').value=new Date().toISOString().slice(0,10); popularDropdownsGlobais(); document.getElementById('modalLancamento').style.display='flex'; }
function abrirModalEditarLancamento(id) { const lanc=lancamentos.find(l=>l.id===id); if(!lanc)return; editandoLancamento=true; document.getElementById('modalLancamentoTitle').innerText='Editar Lançamento'; document.getElementById('lancamentoId').value=lanc.id; document.getElementById('lancamentoDescricao').value=lanc.descricao; document.getElementById('lancamentoValor').value=lanc.valor; document.getElementById('lancamentoData').value=lanc.data; document.getElementById('lancamentoFuncionarioId').value=lanc.funcionarioId; document.getElementById('lancamentoPlanoContaId').value=lanc.planoContaId; document.getElementById('lancamentoRecorrente').checked = lanc.recorrente || false; document.getElementById('modalLancamento').style.display='flex'; }
function abrirModalPagamento(funcId, mesAno, valor) { popularPlanoPagamento(); document.getElementById('pagamentoFuncionarioId').value=funcId; document.getElementById('pagamentoMesAno').value=mesAno; document.getElementById('pagamentoValor').value=valor; document.getElementById('pagamentoData').value=new Date().toISOString().slice(0,10); document.getElementById('modalPagamento').style.display='flex'; }
function fecharModal(id) { document.getElementById(id).style.display='none'; }

function configurarEventos() {
    // Menu lateral
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            // Remove active de todos os itens do menu e de todas as abas
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
            // Ativa o item do menu e a aba correspondente
            item.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            // Se a aba for folha, recalcular com os filtros atuais
            if (tabId === 'folha') {
                const empresa = document.getElementById('folhaEmpresa').value;
                const funcionario = document.getElementById('folhaFuncionario').value;
                const mesAno = document.getElementById('folhaMesAno').value;
                if (mesAno) renderizarFolha(empresa, funcionario, mesAno);
            }
        });
    });

    // Botões principais
    document.getElementById('btnNovaEmpresa').onclick = abrirModalNovaEmpresa;
    document.getElementById('btnNovoFuncionario').onclick = abrirModalNovoFuncionario;
    document.getElementById('btnNovaConta').onclick = abrirModalNovaConta;
    document.getElementById('btnNovoLancamento').onclick = abrirModalNovoLancamento;
    document.getElementById('btnLimparBancoSelectivo').onclick = () => document.getElementById('modalLimpeza').style.display = 'flex';
    document.getElementById('btnBackup').onclick = () => fazerBackup();
    document.getElementById('btnRestore').onclick = () => document.getElementById('restoreFile').click();
    document.getElementById('restoreFile').onchange = (e) => { if (e.target.files[0]) restaurarBackup(e.target.files[0]); };
    document.getElementById('btnFiltrar').onclick = () => { filtroEmpresaAtual = document.getElementById('filtroEmpresa').value; filtroFuncionarioAtual = document.getElementById('filtroFuncionario').value; filtroTipoMovimentoAtual = document.getElementById('filtroTipoMovimento').value; filtroDataInicio = document.getElementById('filtroDataInicio').value; filtroDataFim = document.getElementById('filtroDataFim').value; filtroValorMin = document.getElementById('filtroValorMin').value; filtroValorMax = document.getElementById('filtroValorMax').value; renderizarTabelaLancamentos(); };
    document.getElementById('btnLimparFiltros').onclick = () => { filtroEmpresaAtual = ''; filtroFuncionarioAtual = ''; filtroTipoMovimentoAtual = ''; filtroDataInicio = ''; filtroDataFim = ''; filtroValorMin = ''; filtroValorMax = ''; document.getElementById('filtroEmpresa').value = ''; document.getElementById('filtroFuncionario').value = ''; document.getElementById('filtroTipoMovimento').value = ''; document.getElementById('filtroDataInicio').value = ''; document.getElementById('filtroDataFim').value = ''; document.getElementById('filtroValorMin').value = ''; document.getElementById('filtroValorMax').value = ''; atualizarFiltroFuncionarios(); renderizarTabelaLancamentos(); };
    document.getElementById('btnCalcularFolha').onclick = () => { const empresa = document.getElementById('folhaEmpresa').value; const funcionario = document.getElementById('folhaFuncionario').value; const mesAno = document.getElementById('folhaMesAno').value; if (!mesAno) alert('Selecione um mês/ano'); else renderizarFolha(empresa, funcionario, mesAno); };
    document.getElementById('btnImprimirLancamentos').onclick = () => imprimirPDF('tabelaLancamentosContainer');
    document.getElementById('btnImprimirFolha').onclick = () => imprimirPDF('tabelaFolhaContainer');
    document.getElementById('relTipo').onchange = () => { const tipo = document.getElementById('relTipo').value; document.getElementById('relEmpresa').style.display = tipo === 'empresa' ? 'inline-block' : 'none'; document.getElementById('relFuncionario').style.display = tipo === 'funcionario' ? 'inline-block' : 'none'; document.getElementById('relMes').style.display = tipo === 'mensal' ? 'inline-block' : 'none'; };
    document.getElementById('btnGerarRelatorio').onclick = () => { const tipo = document.getElementById('relTipo').value; const empresaId = document.getElementById('relEmpresa').value; const funcionarioId = document.getElementById('relFuncionario').value; const mesAno = document.getElementById('relMes').value; gerarRelatorio(tipo, empresaId, funcionarioId, mesAno); };
    document.getElementById('btnImprimirRelatorio').onclick = () => imprimirPDF('relatorioContainer');

    // Formulários
    document.getElementById('formEmpresa').addEventListener('submit', async (e) => { e.preventDefault(); const nome = document.getElementById('empresaNome').value; const cnpj = document.getElementById('empresaCnpj').value; if (!nome) return; if (editandoEmpresa) await atualizarEmpresa(document.getElementById('empresaId').value, { nome, cnpj }); else await adicionarEmpresa({ nome, cnpj }); fecharModal('modalEmpresa'); });
    document.getElementById('formFuncionario').addEventListener('submit', async (e) => { e.preventDefault(); const nome = document.getElementById('funcionarioNome').value; const cargo = document.getElementById('funcionarioCargo').value; const salario = parseFloat(document.getElementById('funcionarioSalario').value); const empresaId = document.getElementById('funcionarioEmpresaId').value; if (!nome || !empresaId || isNaN(salario)) return; if (editandoFuncionario) await atualizarFuncionario(document.getElementById('funcionarioId').value, { nome, cargo, salario, empresaId }); else await adicionarFuncionario({ nome, cargo, salario, empresaId }); fecharModal('modalFuncionario'); });
    document.getElementById('formPlanoConta').addEventListener('submit', async (e) => { e.preventDefault(); const nome = document.getElementById('planoNome').value; const tipo = document.getElementById('planoTipo').value; if (!nome) return; if (editandoPlano) await atualizarPlanoConta(document.getElementById('planoId').value, { nome, tipo }); else await adicionarPlanoConta({ nome, tipo }); fecharModal('modalPlanoConta'); });
    document.getElementById('formLancamento').addEventListener('submit', async (e) => { e.preventDefault(); const descricao = document.getElementById('lancamentoDescricao').value; const valor = parseFloat(document.getElementById('lancamentoValor').value); const data = document.getElementById('lancamentoData').value; const funcionarioId = document.getElementById('lancamentoFuncionarioId').value; const planoContaId = document.getElementById('lancamentoPlanoContaId').value; const recorrente = document.getElementById('lancamentoRecorrente').checked; if (!descricao || isNaN(valor) || !data || !funcionarioId || !planoContaId) return alert('Preencha todos os campos'); if (editandoLancamento) await atualizarLancamento(document.getElementById('lancamentoId').value, { descricao, valor, data, funcionarioId, planoContaId, recorrente }); else await adicionarLancamento({ descricao, valor, data, funcionarioId, planoContaId, recorrente }); fecharModal('modalLancamento'); alert('Lançamento salvo!'); });
    document.getElementById('formPagamento').addEventListener('submit', async (e) => { e.preventDefault(); const funcionarioId = document.getElementById('pagamentoFuncionarioId').value; const mesAno = document.getElementById('pagamentoMesAno').value; const dataPagamento = document.getElementById('pagamentoData').value; const valor = parseFloat(document.getElementById('pagamentoValor').value); const planoContaId = document.getElementById('pagamentoPlanoContaId').value; if (!dataPagamento || !planoContaId) return alert('Selecione a data e o plano de conta'); await registrarPagamento(funcionarioId, mesAno, dataPagamento, valor, planoContaId); fecharModal('modalPagamento'); alert('Pagamento registrado com sucesso!'); const empresa = document.getElementById('folhaEmpresa').value; const funcionario = document.getElementById('folhaFuncionario').value; renderizarFolha(empresa, funcionario, mesAno); });
    document.getElementById('formLimpeza').addEventListener('submit', async (e) => { e.preventDefault(); const limparEmpresas = document.getElementById('limparEmpresas').checked; const limparFuncionarios = document.getElementById('limparFuncionarios').checked; const limparPlanos = document.getElementById('limparPlanos').checked; const limparLancamentos = document.getElementById('limparLancamentos').checked; const limparPagamentos = document.getElementById('limparPagamentos').checked; await limparDadosSeletivos(limparEmpresas, limparFuncionarios, limparPlanos, limparLancamentos, limparPagamentos); fecharModal('modalLimpeza'); });

    document.querySelectorAll('.close, .cancel-modal').forEach(el => el.addEventListener('click', () => document.querySelectorAll('.modal').forEach(m => m.style.display = 'none')));
    window.onclick = e => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; };
}

document.addEventListener('DOMContentLoaded', async () => {
    await carregarDados();
    renderizarTodasTabelas();
    popularDropdownsGlobais();
    configurarEventos();
    atualizarFiltroFuncionarios();
    document.getElementById('folhaMesAno').value = new Date().toISOString().slice(0, 7);
});