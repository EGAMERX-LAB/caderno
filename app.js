'use strict';
/* Caderno do Professor — desenvolvido por EG Gamer X
   Versão de teste: tudo fica salvo só no aparelho (localStorage). */

const VERSAO_APP = '0.5 (teste)';
const CHAVE = 'caderno_prof_v1';
const NIVEIS = [
  { v: 1, nome: 'Precisa de apoio', curto: 'Apoio' },
  { v: 2, nome: 'Em desenvolvimento', curto: 'Desenvolv.' },
  { v: 3, nome: 'Adequado', curto: 'Adequado' },
  { v: 4, nome: 'Avançado', curto: 'Avançado' },
];
const TIPOS_REGISTRO = { dificuldade: 'Dificuldade', avanco: 'Avanço', observacao: 'Observação' };
const TIPOS_EVENTO = ['Prova', 'Reunião', 'Entrega de notas', 'Evento da escola', 'Lembrete'];
const TURNOS = ['Manhã', 'Tarde', 'Integral', 'Noite'];
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MEDIA_MINIMA = 6;

/* ---------- Dados ---------- */

function bancoVazio() {
  return {
    versao: 1,
    config: {
      professor: '', escola: '', anoLetivo: new Date().getFullYear(), ultimoBackup: null,
      disciplinas: ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia',
        'Arte', 'Educação Física', 'Língua Inglesa', 'Ensino Religioso'],
      areas: ['Leitura', 'Escrita', 'Matemática', 'Participação', 'Comportamento', 'Socialização'],
    },
    turmas: [], alunos: [], chamadas: {}, avaliacoes: [], notas: {}, desenv: {},
    registros: [], aulas: [], eventos: [],
  };
}

function normalizar(d) {
  const base = bancoVazio();
  for (const k in base) if (d[k] === undefined) d[k] = base[k];
  for (const k in base.config) if (d.config[k] === undefined) d.config[k] = base.config[k];
  return d;
}

function carregar() {
  try {
    const t = localStorage.getItem(CHAVE);
    if (t) return normalizar(JSON.parse(t));
  } catch (e) { console.error(e); }
  return bancoVazio();
}

let db = carregar();

function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(db)); }
  catch (e) { toast('Erro ao salvar: ' + e.message); }
}

const turma = id => db.turmas.find(t => t.id === id);
const aluno = id => db.alunos.find(a => a.id === id);
const alunosDa = tid => db.alunos.filter(a => a.turmaId === tid).sort(ordemAlunos);
const nomeTurma = id => turma(id)?.nome || '(turma excluída)';

/* ---------- Utilidades ---------- */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function novoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dataDe(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); }
function hoje() { return isoLocal(new Date()); }
function somaDias(iso, n) { const d = dataDe(iso); d.setDate(d.getDate() + n); return isoLocal(d); }
function fmtData(iso) { if (!iso) return ''; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
function fmtDataCurta(iso) { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}/${m}`; }
function fmtDia(iso) {
  const h = hoje();
  if (iso === h) return 'Hoje';
  if (iso === somaDias(h, 1)) return 'Amanhã';
  if (iso === somaDias(h, -1)) return 'Ontem';
  return `${SEMANA[dataDe(iso).getDay()]}, ${fmtData(iso)}`;
}
function bimestreAtual() { const m = new Date().getMonth() + 1; return m <= 4 ? 1 : m <= 7 ? 2 : m <= 9 ? 3 : 4; }
function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  return (Math.round(n * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function porNome(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }
function ordemAlunos(a, b) { return (a.numero || 999) - (b.numero || 999) || porNome(a, b); }
function iniciais(nome) {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function linhas(texto) { return texto.split('\n').map(s => s.trim()).filter(Boolean); }
function plural(n, um, varios) { return `${n} ${n === 1 ? um : varios}`; }

function frequencia(alunoId) {
  const a = aluno(alunoId);
  let p = 0, f = 0, j = 0;
  for (const [k, reg] of Object.entries(db.chamadas)) {
    if (!k.startsWith(a.turmaId + '|')) continue;
    const s = reg[alunoId];
    if (s === 'P') p++; else if (s === 'F') f++; else if (s === 'J') j++;
  }
  const total = p + f + j;
  return { p, f, j, total, pct: total ? p / total * 100 : null };
}

function notaNormalizada(av, alunoId) {
  const n = db.notas[av.id]?.[alunoId];
  if (n == null) return null;
  return n / (av.valorMax || 10) * 10;
}
function media(alunoId, avs) {
  const vals = avs.map(av => notaNormalizada(av, alunoId)).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}
function celNota(m) {
  if (m == null) return '—';
  return `<span class="${m < MEDIA_MINIMA ? 'ruim' : 'bom'}">${fmtNum(m)}</span>`;
}
function temDificuldade(alunoId) {
  const d = db.desenv[alunoId]?.[bimestreAtual()];
  return d ? Object.values(d).some(v => v === 1) : false;
}
function opcoesDisciplina(atual) {
  const l = [...db.config.disciplinas];
  if (atual && !l.includes(atual)) l.push(atual);
  return [['', '—'], ...l.map(x => [x, x])];
}

/* ---------- Ponte com o Android (com alternativa para navegador) ---------- */

const nativo = window.Android;
const NO_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Fora do app Android (iPhone ou navegador): guarda os arquivos no aparelho para abrir sem internet.
if (!nativo && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Modo offline indisponível:', e));
}

function salvarArquivo(nome, texto, mime, aoTerminar) {
  if (nativo?.salvarArquivo) {
    window.__aoSalvar = aoTerminar;
    nativo.salvarArquivo(nome, texto, mime);
    return;
  }
  // iPhone/iPad: abre a folha "Compartilhar" (Salvar em Arquivos, WhatsApp, e-mail...).
  if (NO_IOS) {
    const arq = new File([texto], nome, { type: mime });
    if (navigator.canShare?.({ files: [arq] })) {
      navigator.share({ files: [arq], title: nome })
        .then(() => aoTerminar?.(true), () => aoTerminar?.(false));
      return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: mime }));
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  aoTerminar?.(true);
}
window.aoSalvarArquivo = ok => {
  const cb = window.__aoSalvar; window.__aoSalvar = null;
  toast(ok ? 'Arquivo salvo' : 'O arquivo não foi salvo');
  cb?.(ok);
};

function abrirArquivo(aoLer) {
  if (nativo?.abrirArquivo) {
    window.__aoAbrir = aoLer;
    nativo.abrirArquivo();
    return;
  }
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = '.json,application/json';
  i.onchange = () => {
    const f = i.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => aoLer(r.result);
    r.readAsText(f);
  };
  i.click();
}
window.aoAbrirArquivo = texto => {
  const cb = window.__aoAbrir; window.__aoAbrir = null;
  if (cb && texto != null) cb(texto);
};

function imprimir(titulo) {
  if (nativo?.imprimir) nativo.imprimir(titulo); else window.print();
}

/* ---------- Interface base ---------- */

let rotaPai = null;
let ultimoCaminho = null;
let formSujo = false;
let seqModal = 0;
let timerToast = null;

function render(titulo, html, { voltar = null, acao = '' } = {}) {
  rotaPai = voltar;
  $('#titulo').textContent = titulo;
  $('#btn-voltar').hidden = !voltar;
  $('#marca').hidden = !!voltar;
  $('#topo-acao').innerHTML = acao;
  $('#tela').innerHTML = html;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('mostrar');
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove('mostrar'), 2400);
}

function vazio(html) { return `<div class="vazio">${html}</div>`; }

function campo(rotulo, nome, valor = '', tipo = 'text', extra = '') {
  return `<label class="campo"><span>${esc(rotulo)}</span><input type="${tipo}" name="${nome}" value="${esc(valor)}" ${extra}></label>`;
}
function campoTexto(rotulo, nome, valor = '', nLinhas = 3, extra = '') {
  return `<label class="campo"><span>${esc(rotulo)}</span><textarea name="${nome}" rows="${nLinhas}" ${extra}>${esc(valor)}</textarea></label>`;
}
function campoSelect(rotulo, nome, opcoes, valor = '') {
  const ops = opcoes.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(valor ?? '') ? 'selected' : ''}>${esc(t)}</option>`;
  }).join('');
  return `<label class="campo"><span>${esc(rotulo)}</span><select name="${nome}">${ops}</select></label>`;
}
function lerForm(el) {
  const o = {};
  $$('[name]', el).forEach(i => { o[i.name] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
  return o;
}

function abrirModal(titulo, corpo, botoes = []) {
  const meu = ++seqModal;
  const raiz = $('#modal-raiz');
  raiz.innerHTML = `<div class="modal-fundo"><div class="modal" role="dialog" aria-modal="true">
    <h2>${esc(titulo)}</h2><div class="modal-corpo">${corpo}</div>
    <div class="modal-botoes">${botoes.map((b, i) =>
      `<button type="button" class="btn ${b.classe || ''}" data-i="${i}">${esc(b.texto)}</button>`).join('')}</div>
  </div></div>`;
  raiz.hidden = false;
  const modal = $('.modal', raiz);
  $$('.modal-botoes button', raiz).forEach(btn => btn.onclick = () => {
    const b = botoes[+btn.dataset.i];
    const r = b.acao ? b.acao(modal) : undefined;
    // Só fecha se a ação não pediu para manter e não abriu outro modal no lugar.
    if (r !== false && seqModal === meu) fecharModal();
  });
  $('.modal-fundo', raiz).onclick = e => { if (e.target.classList.contains('modal-fundo')) fecharModal(); };
  return modal;
}
function fecharModal() { const r = $('#modal-raiz'); r.hidden = true; r.innerHTML = ''; seqModal++; }
const modalAberto = () => !$('#modal-raiz').hidden;

function confirmar(msg, textoBotao, acao, perigo = true) {
  abrirModal('Confirmar', `<p>${esc(msg)}</p>`, [
    { texto: 'Cancelar' },
    { texto: textoBotao, classe: perigo ? 'perigo' : 'primario', acao },
  ]);
}

function escolherTurma(titulo, aoEscolher) {
  if (db.turmas.length === 1) return aoEscolher(db.turmas[0].id);
  const m = abrirModal(titulo, `<div class="escolha">${[...db.turmas].sort(porNome).map(t =>
    `<button class="btn" data-t="${t.id}">${esc(t.nome)}</button>`).join('')}</div>`, [{ texto: 'Cancelar' }]);
  $$('[data-t]', m).forEach(b => b.onclick = () => { fecharModal(); aoEscolher(b.dataset.t); });
}

function ir(hash) { if (location.hash === hash) rotear(); else location.hash = hash; }

/* ---------- Navegação ---------- */

const ROTAS = [
  [/^\/$/, telaInicio],
  [/^\/turmas$/, telaTurmas],
  [/^\/turma\/([^/]+)(?:\/(\w+))?$/, telaTurma],
  [/^\/aluno\/([^/]+)$/, telaAluno],
  [/^\/relatorio\/([^/]+)$/, telaRelatorio],
  [/^\/aulas$/, telaAulas],
  [/^\/aula\/([^/]+)$/, telaAula],
  [/^\/agenda$/, telaAgenda],
  [/^\/config$/, telaConfig],
];

function rotear() {
  formSujo = false;
  if (modalAberto()) fecharModal();
  const [caminho, qs] = (location.hash.slice(1) || '/').split('?');
  const params = new URLSearchParams(qs || '');
  for (const [re, fn] of ROTAS) {
    const m = caminho.match(re);
    if (!m) continue;
    fn(...m.slice(1), params);
    marcarMenu(caminho);
    if (caminho !== ultimoCaminho) window.scrollTo(0, 0);
    ultimoCaminho = caminho;
    return;
  }
  location.replace('#/');
}

function marcarMenu(caminho) {
  let sec = '/';
  if (/^\/(turma|aluno|relatorio)/.test(caminho)) sec = '/turmas';
  else if (/^\/aula/.test(caminho)) sec = '/aulas';
  else if (caminho !== '/') sec = caminho;
  $$('#menu a').forEach(a => a.classList.toggle('ativo', a.dataset.nav === sec));
}

function voltar() {
  if (formSujo) {
    confirmar('Você tem alterações que não foram salvas. Sair mesmo assim?', 'Sair sem salvar',
      () => { formSujo = false; voltar(); });
    return true;
  }
  const caminho = (location.hash.slice(1) || '/').split('?')[0];
  if (rotaPai) { location.replace('#' + rotaPai); return true; }
  if (caminho !== '/') { location.replace('#/'); return true; }
  return false;
}

// Chamado pelo botão "voltar" do Android. Retorna false para fechar o app.
window.appVoltar = function () {
  if (modalAberto()) { fecharModal(); return true; }
  return voltar();
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-ir]');
  if (!el || !el.dataset.ir) return;
  e.preventDefault();
  if (formSujo) {
    confirmar('Você tem alterações que não foram salvas. Sair mesmo assim?', 'Sair sem salvar',
      () => { formSujo = false; ir(el.dataset.ir); });
    return;
  }
  ir(el.dataset.ir);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalAberto()) fecharModal(); });

/* ---------- Início ---------- */

function telaInicio() {
  const h = hoje(), c = db.config;
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = c.professor ? `, ${esc(c.professor.split(' ')[0])}` : '';
  let html = `<section class="boas-vindas">
    <p class="saudacao">${saudacao}${nome}!</p>
    <p class="data-hoje">${SEMANA[new Date().getDay()]}, ${fmtData(h)} · ${bimestreAtual()}º bimestre</p>
  </section>`;

  if (!db.turmas.length) {
    html += `<div class="cartao destaque">
      <img class="logo-sobre" src="logo.webp" alt="Logo EG Gamer X">
      <h3>Bem-vindo(a) ao Caderno do Professor</h3>
      <p>Comece criando sua primeira turma e adicionando os alunos. Tudo fica salvo só neste aparelho.</p>
      <div class="linha-botoes">
        <button class="btn primario" id="ini-turma">Criar primeira turma</button>
        <button class="btn" id="ini-exemplo">Ver com dados de exemplo</button>
      </div></div>`;
    render('Caderno do Professor', html);
    $('#ini-turma').onclick = () => modalTurma();
    $('#ini-exemplo').onclick = carregarExemplo;
    return;
  }

  html += `<div class="atalhos">
    <button class="atalho" id="at-chamada"><span class="ic">✓</span>Fazer chamada</button>
    <button class="atalho" data-ir="#/aula/nova"><span class="ic">✎</span>Planejar aula</button>
    <button class="atalho" id="at-lembrete"><span class="ic">◷</span>Lembrete</button>
  </div>`;

  if (db.alunos.length && (!c.ultimoBackup || somaDias(c.ultimoBackup, 7) < h)) {
    html += `<div class="cartao destaque" style="margin-top:16px">
      <p><b>Faça uma cópia de segurança.</b> Seus dados ficam só neste celular.
      ${c.ultimoBackup ? `Última cópia em ${fmtData(c.ultimoBackup)}.` : 'Você ainda não fez nenhuma cópia.'}</p>
      <button class="btn primario" data-ir="#/config">Fazer cópia agora</button></div>`;
  }

  const aulasHoje = db.aulas.filter(a => a.data === h).sort((x, y) => nomeTurma(x.turmaId).localeCompare(nomeTurma(y.turmaId)));
  html += `<h3 class="secao">Aulas de hoje</h3>` + (aulasHoje.length
    ? `<div class="lista">${aulasHoje.map(a => itemAula(a)).join('')}</div>`
    : vazio('Nenhuma aula planejada para hoje. <a href="#/aula/nova">Planejar agora</a>'));

  const limite = somaDias(h, 7);
  const proximos = db.eventos.filter(e => !e.feito && e.data >= h && e.data <= limite).sort(ordemEvento);
  const atrasados = db.eventos.filter(e => !e.feito && e.data < h).length;
  html += `<h3 class="secao">Próximos 7 dias</h3>` + (proximos.length
    ? `<div class="lista">${proximos.map(e => itemEvento(e, true)).join('')}</div>`
    : vazio('Nada marcado para os próximos dias.'));
  if (atrasados) html += `<p class="aviso"><a href="#/agenda">${plural(atrasados, 'lembrete pendente', 'lembretes pendentes')} de dias anteriores</a></p>`;

  const regs = db.registros.filter(r => r.tipo === 'dificuldade' && aluno(r.alunoId))
    .sort((x, y) => y.data.localeCompare(x.data)).slice(0, 5);
  if (regs.length) {
    html += `<h3 class="secao">Dificuldades registradas</h3><div class="lista">${regs.map(r => {
      const al = aluno(r.alunoId);
      return `<a class="item" href="#/aluno/${al.id}"><div>
        <strong>${esc(al.nome)}</strong> <span class="sub">· ${esc(nomeTurma(al.turmaId))}</span>
        <div class="sub">${r.area ? esc(r.area) + ': ' : ''}${esc(r.texto)}</div></div>
        <span class="sub">${fmtDataCurta(r.data)}</span></a>`;
    }).join('')}</div>`;
  }

  render('Caderno do Professor', html);
  $('#at-chamada').onclick = () => escolherTurma('Chamada de qual turma?', id => ir(`#/turma/${id}/chamada`));
  $('#at-lembrete').onclick = () => modalEvento();
  ligarEventos($('#tela'));
}

/* ---------- Turmas ---------- */

function telaTurmas() {
  const html = (db.turmas.length
    ? `<div class="lista">${[...db.turmas].sort(porNome).map(t => {
      const n = alunosDa(t.id).length;
      return `<a class="item" href="#/turma/${t.id}"><div><strong>${esc(t.nome)}</strong>
        <div class="sub">${[t.turno, plural(n, 'aluno', 'alunos')].filter(Boolean).map(esc).join(' · ')}</div></div>
        <span class="seta">›</span></a>`;
    }).join('')}</div>`
    : vazio('Nenhuma turma ainda.'))
    + `<button class="btn primario largo" id="nova-turma">+ Nova turma</button>`;
  render('Turmas', html);
  $('#nova-turma').onclick = () => modalTurma();
}

function modalTurma(t) {
  const editando = !!t;
  abrirModal(editando ? 'Editar turma' : 'Nova turma',
    campo('Nome da turma', 'nome', t?.nome || '', 'text', 'placeholder="Ex.: 4º ano B"')
    + campoSelect('Turno', 'turno', [['', '—'], ...TURNOS], t?.turno || '')
    + campo('Escola (opcional)', 'escola', t?.escola || ''),
    [
      ...(editando ? [{ texto: 'Excluir', classe: 'perigo-texto esq', acao: () => excluirTurma(t) }] : []),
      { texto: 'Cancelar' },
      {
        texto: 'Salvar', classe: 'primario', acao: m => {
          const d = lerForm(m);
          if (!d.nome) { toast('Informe o nome da turma'); return false; }
          if (editando) { Object.assign(t, d); salvar(); rotear(); return; }
          const nova = { id: novoId(), ...d, criadoEm: hoje() };
          db.turmas.push(nova);
          salvar();
          ir(`#/turma/${nova.id}`);
        },
      },
    ]);
}

function excluirTurma(t) {
  const als = alunosDa(t.id);
  confirmar(`Excluir a turma "${t.nome}" com ${plural(als.length, 'aluno', 'alunos')}, chamadas, notas e aulas? Isso não pode ser desfeito.`,
    'Excluir turma', () => {
      als.forEach(a => apagarDadosAluno(a.id));
      db.alunos = db.alunos.filter(a => a.turmaId !== t.id);
      const avs = db.avaliacoes.filter(v => v.turmaId === t.id);
      avs.forEach(v => delete db.notas[v.id]);
      db.avaliacoes = db.avaliacoes.filter(v => v.turmaId !== t.id);
      Object.keys(db.chamadas).forEach(k => { if (k.startsWith(t.id + '|')) delete db.chamadas[k]; });
      db.aulas = db.aulas.filter(a => a.turmaId !== t.id);
      db.eventos.forEach(e => { if (e.turmaId === t.id) e.turmaId = ''; });
      db.turmas = db.turmas.filter(x => x.id !== t.id);
      salvar();
      toast('Turma excluída');
      location.replace('#/turmas');
    });
}

function telaTurma(id, aba, params) {
  const t = turma(id);
  if (!t) { location.replace('#/turmas'); return; }
  const abas = { alunos: ['Alunos', abaAlunos], chamada: ['Chamada', abaChamada], notas: ['Notas', abaNotas], aulas: ['Aulas', abaAulasTurma] };
  if (!abas[aba]) aba = 'alunos';
  const html = `<nav class="abas">${Object.entries(abas).map(([k, [n]]) =>
    `<a href="#/turma/${id}/${k}" class="${k === aba ? 'ativa' : ''}">${n}</a>`).join('')}</nav><div id="conteudo-aba"></div>`;
  render(t.nome, html, {
    voltar: '/turmas',
    acao: `<button class="btn-icone" id="editar-turma" aria-label="Editar turma">✎</button>`,
  });
  $('#editar-turma').onclick = () => modalTurma(t);
  abas[aba][1](t, $('#conteudo-aba'), params);
}

function abaAlunos(t, alvo) {
  const lista = alunosDa(t.id);
  const avsBim = db.avaliacoes.filter(v => v.turmaId === t.id && v.bimestre === bimestreAtual());
  alvo.innerHTML = (lista.length
    ? `<div class="lista">${lista.map(a => {
      const fr = frequencia(a.id);
      const m = media(a.id, avsBim);
      const info = [fr.total ? `Freq. ${Math.round(fr.pct)}%` : 'Sem chamada'];
      if (m != null) info.push(`Média ${fmtNum(m)}`);
      return `<a class="item" href="#/aluno/${a.id}"><span class="num">${a.numero || ''}</span>
        <div class="cresce"><strong>${esc(a.nome)}</strong>
        <div class="sub">${info.join(' · ')}${temDificuldade(a.id) ? ' · <span class="alerta">precisa de apoio</span>' : ''}</div></div>
        <span class="seta">›</span></a>`;
    }).join('')}</div>`
    : vazio('Nenhum aluno nesta turma ainda.'))
    + `<button class="btn primario largo" id="add-alunos">+ Adicionar alunos</button>`;
  $('#add-alunos').onclick = () => modalAdicionarAlunos(t);
}

function modalAdicionarAlunos(t) {
  abrirModal('Adicionar alunos',
    campoTexto('Nomes dos alunos (um por linha)', 'nomes', '', 8, 'placeholder="Enzo Fernandes\nMaria Eduarda Rocha\n..."')
    + `<p class="legenda">Dica: você pode colar a lista inteira da turma de uma vez. O número da chamada é preenchido na ordem.</p>`,
    [
      { texto: 'Cancelar' },
      {
        texto: 'Adicionar', classe: 'primario', acao: m => {
          const nomes = linhas(lerForm(m).nomes);
          if (!nomes.length) { toast('Digite pelo menos um nome'); return false; }
          let n = Math.max(0, ...alunosDa(t.id).map(a => a.numero || 0));
          nomes.forEach(nome => db.alunos.push({ id: novoId(), turmaId: t.id, nome, numero: ++n, obs: '' }));
          salvar();
          toast(`${plural(nomes.length, 'aluno adicionado', 'alunos adicionados')}`);
          rotear();
        },
      },
    ]);
}

function abaChamada(t, alvo, params) {
  const lista = alunosDa(t.id);
  if (!lista.length) { alvo.innerHTML = vazio('Adicione alunos para fazer a chamada.'); return; }
  const data = params.get('data') || hoje();
  const chave = `${t.id}|${data}`;
  const reg = db.chamadas[chave] || {};
  const nomesStatus = { P: 'Presente', F: 'Falta', J: 'Falta justificada' };
  alvo.innerHTML = `
    <div class="barra-data">
      <button class="btn-icone" id="ch-ant" aria-label="Dia anterior">‹</button>
      <input type="date" id="ch-data" value="${data}">
      <button class="btn-icone" id="ch-prox" aria-label="Próximo dia">›</button>
    </div>
    <p class="resumo-chamada"><b>${fmtDia(data)}</b> · <span id="ch-resumo"></span></p>
    <div class="linha-botoes">
      <button class="btn" id="ch-todos">Marcar restantes como presentes</button>
      ${db.chamadas[chave] ? '<button class="btn perigo-texto" id="ch-limpar">Limpar dia</button>' : ''}
    </div>
    <div class="lista">${lista.map(a => `<div class="item chamada" data-aluno="${a.id}">
      <span class="num">${a.numero || ''}</span><span class="cresce">${esc(a.nome)}</span>
      <div class="pfj">${['P', 'F', 'J'].map(s =>
        `<button class="pfj-${s} ${reg[a.id] === s ? 'on' : ''}" data-s="${s}" aria-label="${nomesStatus[s]}">${s}</button>`).join('')}</div>
    </div>`).join('')}</div>
    <p class="legenda">P = presente · F = falta · J = falta justificada. Toque de novo para desmarcar. Salva automaticamente.</p>`;

  const irData = d => location.replace(`#/turma/${t.id}/chamada?data=${d}`);
  $('#ch-data').onchange = e => { if (e.target.value) irData(e.target.value); };
  $('#ch-ant').onclick = () => irData(somaDias(data, -1));
  $('#ch-prox').onclick = () => irData(somaDias(data, 1));

  const resumo = () => {
    const v = Object.values(db.chamadas[chave] || {});
    const cont = s => v.filter(x => x === s).length;
    const sem = lista.length - v.length;
    $('#ch-resumo').innerHTML = `<span class="ok">${plural(cont('P'), 'presente', 'presentes')}</span> · <span class="ruim">${plural(cont('F'), 'falta', 'faltas')}</span>`
      + (cont('J') ? ` · ${plural(cont('J'), 'justificada', 'justificadas')}` : '') + (sem ? ` · ${sem} sem marcar` : '');
  };
  resumo();

  $$('.item.chamada', alvo).forEach(linha => {
    const id = linha.dataset.aluno;
    $$('button', linha).forEach(b => b.onclick = () => {
      const r = db.chamadas[chave] ||= {};
      if (r[id] === b.dataset.s) delete r[id]; else r[id] = b.dataset.s;
      if (!Object.keys(r).length) delete db.chamadas[chave];
      salvar();
      $$('button', linha).forEach(x => x.classList.toggle('on', r[id] === x.dataset.s));
      resumo();
    });
  });
  $('#ch-todos').onclick = () => {
    const r = db.chamadas[chave] ||= {};
    lista.forEach(a => { if (!r[a.id]) r[a.id] = 'P'; });
    salvar();
    rotear();
  };
  $('#ch-limpar')?.addEventListener('click', () => confirmar(`Apagar a chamada de ${fmtData(data)}?`, 'Apagar', () => {
    delete db.chamadas[chave];
    salvar();
    rotear();
  }));
}

function abaNotas(t, alvo, params) {
  const bim = +(params.get('bim') || bimestreAtual());
  const disc = params.get('disc') || '';
  const todas = db.avaliacoes.filter(v => v.turmaId === t.id && v.bimestre === bim)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const avs = disc ? todas.filter(v => v.disciplina === disc) : todas;
  const discs = [...new Set(todas.map(v => v.disciplina).filter(Boolean))];
  const lista = alunosDa(t.id);
  const url = (b, d) => `#/turma/${t.id}/notas?bim=${b}${d ? '&disc=' + encodeURIComponent(d) : ''}`;

  let html = `<div class="chips">${[1, 2, 3, 4].map(b =>
    `<a class="chip ${b === bim ? 'on' : ''}" href="${url(b, '')}">${b}º bim</a>`).join('')}</div>`;
  if (discs.length > 1) {
    html += `<div class="chips">${['', ...discs].map(d =>
      `<a class="chip mini ${d === disc ? 'on' : ''}" href="${url(bim, d)}">${esc(d || 'Todas as disciplinas')}</a>`).join('')}</div>`;
  }
  if (!lista.length) html += vazio('Adicione alunos para lançar notas.');
  else if (!avs.length) html += vazio('Nenhuma avaliação neste bimestre. Crie uma para lançar as notas.');
  else {
    html += `<div class="tabela-rolagem"><table class="notas"><thead><tr><th class="fixa">Aluno</th>
      ${avs.map(v => `<th><button class="th-av" data-av="${v.id}">${esc(v.titulo)}
        <small>${esc(v.disciplina || '')}${v.data ? ' · ' + fmtDataCurta(v.data) : ''} · vale ${fmtNum(v.valorMax)}</small></button></th>`).join('')}
      <th>Média<small>0 a 10</small></th></tr></thead>
      <tbody>${lista.map(a => `<tr data-aluno="${a.id}"><td class="fixa">${esc(a.nome)}</td>
        ${avs.map(v => `<td><input type="number" inputmode="decimal" min="0" max="${v.valorMax}" step="0.1"
          data-av="${v.id}" value="${db.notas[v.id]?.[a.id] ?? ''}" aria-label="Nota de ${esc(a.nome)} em ${esc(v.titulo)}"></td>`).join('')}
        <td class="media" data-media>${celNota(media(a.id, avs))}</td></tr>`).join('')}</tbody></table></div>
      <p class="legenda">Toque no nome da avaliação para editar ou excluir. A média converte cada nota para 0 a 10 (abaixo de ${MEDIA_MINIMA} fica em vermelho).</p>`;
  }
  html += `<button class="btn primario largo" id="nova-av">+ Nova avaliação</button>`;
  alvo.innerHTML = html;

  $('#nova-av').onclick = () => modalAvaliacao(t, null, bim, disc);
  $$('.th-av', alvo).forEach(b => b.onclick = () => modalAvaliacao(t, db.avaliacoes.find(v => v.id === b.dataset.av)));
  $$('input[data-av]', alvo).forEach(inp => {
    inp.onchange = () => {
      const av = db.avaliacoes.find(v => v.id === inp.dataset.av);
      const alunoId = inp.closest('tr').dataset.aluno;
      const notas = db.notas[av.id] ||= {};
      const txt = inp.value.replace(',', '.').trim();
      if (txt === '') delete notas[alunoId];
      else {
        let n = parseFloat(txt);
        if (isNaN(n)) { inp.value = notas[alunoId] ?? ''; return; }
        if (n < 0) n = 0;
        if (n > av.valorMax) { toast(`A nota máxima desta avaliação é ${fmtNum(av.valorMax)}`); n = av.valorMax; }
        notas[alunoId] = n;
        inp.value = n;
      }
      salvar();
      inp.closest('tr').querySelector('[data-media]').innerHTML = celNota(media(alunoId, avs));
    };
    inp.onkeydown = e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const prox = inp.closest('tr').nextElementSibling?.querySelector(`input[data-av="${inp.dataset.av}"]`);
      if (prox) prox.focus(); else inp.blur();
    };
  });
}

function modalAvaliacao(t, av, bim, disc) {
  const editando = !!av;
  abrirModal(editando ? 'Editar avaliação' : 'Nova avaliação',
    campo('Nome', 'titulo', av?.titulo || '', 'text', 'placeholder="Ex.: Prova 1, Trabalho, Ditado"')
    + campoSelect('Disciplina', 'disciplina', opcoesDisciplina(av?.disciplina), av?.disciplina ?? disc ?? '')
    + `<div class="duas">${campoSelect('Bimestre', 'bimestre', [1, 2, 3, 4].map(b => [b, b + 'º']), av?.bimestre || bim)}
      ${campo('Vale quantos pontos', 'valorMax', av?.valorMax ?? 10, 'number', 'min="0.1" step="0.1" inputmode="decimal"')}</div>`
    + campo('Data', 'data', av?.data || hoje(), 'date'),
    [
      ...(editando ? [{
        texto: 'Excluir', classe: 'perigo-texto esq', acao: () => confirmar(
          `Excluir a avaliação "${av.titulo}" e todas as notas lançadas nela?`, 'Excluir', () => {
            delete db.notas[av.id];
            db.avaliacoes = db.avaliacoes.filter(v => v.id !== av.id);
            salvar();
            rotear();
          }),
      }] : []),
      { texto: 'Cancelar' },
      {
        texto: 'Salvar', classe: 'primario', acao: m => {
          const d = lerForm(m);
          const valorMax = parseFloat(String(d.valorMax).replace(',', '.'));
          if (!d.titulo) { toast('Dê um nome para a avaliação'); return false; }
          if (!(valorMax > 0)) { toast('Informe quantos pontos vale'); return false; }
          const dados = { titulo: d.titulo, disciplina: d.disciplina, bimestre: +d.bimestre, valorMax, data: d.data };
          if (editando) Object.assign(av, dados);
          else db.avaliacoes.push({ id: novoId(), turmaId: t.id, ...dados });
          salvar();
          if (editando || dados.bimestre === bim) rotear();
          else location.replace(`#/turma/${t.id}/notas?bim=${dados.bimestre}`);
        },
      },
    ]);
}

function abaAulasTurma(t, alvo) {
  const aulas = db.aulas.filter(a => a.turmaId === t.id).sort((x, y) => y.data.localeCompare(x.data));
  alvo.innerHTML = `<button class="btn primario largo" data-ir="#/aula/nova?turma=${t.id}">+ Planejar aula</button>`
    + (aulas.length ? `<div class="lista">${aulas.map(a => itemAula(a, true)).join('')}</div>` : vazio('Nenhuma aula planejada para esta turma.'));
}

/* ---------- Aluno ---------- */

function apagarDadosAluno(id) {
  delete db.desenv[id];
  db.registros = db.registros.filter(r => r.alunoId !== id);
  Object.values(db.notas).forEach(n => delete n[id]);
  Object.values(db.chamadas).forEach(c => delete c[id]);
}

function tabelaNotasAluno(a) {
  const avs = db.avaliacoes.filter(v => v.turmaId === a.turmaId);
  if (!avs.length) return vazio('Nenhuma avaliação lançada para a turma.');
  const discs = [...new Set(avs.map(v => v.disciplina || 'Geral'))].sort((x, y) => x.localeCompare(y, 'pt-BR'));
  const cel = (d, b) => celNota(media(a.id, avs.filter(v => (d == null || (v.disciplina || 'Geral') === d) && v.bimestre === b)));
  return `<div class="tabela-rolagem"><table><thead><tr><th>Disciplina</th>${[1, 2, 3, 4].map(b => `<th>${b}º</th>`).join('')}</tr></thead>
    <tbody>${discs.map(d => `<tr><td>${esc(d)}</td>${[1, 2, 3, 4].map(b => `<td>${cel(d, b)}</td>`).join('')}</tr>`).join('')}
    <tr class="total"><td>Média geral</td>${[1, 2, 3, 4].map(b => `<td>${cel(null, b)}</td>`).join('')}</tr></tbody></table></div>`;
}

function telaAluno(id, params) {
  const a = aluno(id);
  if (!a) { location.replace('#/turmas'); return; }
  const t = turma(a.turmaId);
  const bim = +(params.get('bim') || bimestreAtual());
  const fr = frequencia(id);
  const dBim = db.desenv[id]?.[bim] || {};

  let html = `<div class="cartao perfil"><div class="avatar">${esc(iniciais(a.nome))}</div><div>
      <h2>${esc(a.nome)}</h2>
      <p class="sub"><a href="#/turma/${a.turmaId}">${esc(t?.nome || '')}</a>${a.numero ? ' · nº ' + a.numero : ''}</p>
    </div></div>`;
  if (a.obs) html += `<div class="cartao"><p class="sub">Observações gerais</p><p style="white-space:pre-wrap">${esc(a.obs)}</p></div>`;

  html += `<div class="indicadores">
    <div><b>${fr.total ? Math.round(fr.pct) + '%' : '—'}</b><span>frequência</span></div>
    <div><b>${fr.f}</b><span>faltas</span></div>
    <div><b>${fr.j}</b><span>justificadas</span></div></div>`;

  html += `<h3 class="secao">Notas</h3>${tabelaNotasAluno(a)}`;

  html += `<h3 class="secao">Desenvolvimento</h3>
    <div class="chips">${[1, 2, 3, 4].map(b => `<a class="chip ${b === bim ? 'on' : ''}" href="#/aluno/${id}?bim=${b}">${b}º bim</a>`).join('')}</div>
    <div class="desenv">${db.config.areas.map(ar => `<div class="desenv-linha" data-area="${esc(ar)}">
      <div class="desenv-area"><span>${esc(ar)}</span><span class="hist" title="1º ao 4º bimestre">${[1, 2, 3, 4].map(b =>
        `<i class="ponto n${db.desenv[id]?.[b]?.[ar] || 0}"></i>`).join('')}</span></div>
      <div class="niveis">${NIVEIS.map(n =>
        `<button class="nivel n${n.v} ${dBim[ar] === n.v ? 'on' : ''}" data-v="${n.v}" title="${n.nome}">${n.curto}</button>`).join('')}</div>
    </div>`).join('')}</div>
    <p class="legenda">Toque para marcar o nível no ${bim}º bimestre. As bolinhas mostram a evolução do 1º ao 4º bimestre
    (<span style="color:var(--n1)">●</span> apoio, <span style="color:var(--n2)">●</span> em desenvolvimento,
    <span style="color:var(--n3)">●</span> adequado, <span style="color:var(--n4)">●</span> avançado).</p>`;

  const regs = db.registros.filter(r => r.alunoId === id).sort((x, y) => y.data.localeCompare(x.data));
  html += `<h3 class="secao">Anotações pedagógicas</h3>
    <button class="btn largo" id="novo-reg">+ Nova anotação</button>`
    + (regs.length ? regs.map(r => `<div class="reg reg-${r.tipo}">
        <div class="reg-topo"><span class="selo ${r.tipo}">${TIPOS_REGISTRO[r.tipo]}</span>
        ${r.area ? `<span class="sub">${esc(r.area)}</span>` : ''}<span class="sub dir">${fmtData(r.data)}</span></div>
        <p>${esc(r.texto)}</p><button class="link-btn" data-reg="${r.id}">Editar</button></div>`).join('')
      : vazio('Registre dificuldades, avanços e observações sobre a aprendizagem.'));

  html += `<button class="btn primario largo" data-ir="#/relatorio/${id}">Gerar relatório do aluno</button>`;

  render(a.nome, html, {
    voltar: `/turma/${a.turmaId}`,
    acao: `<button class="btn-icone" id="editar-aluno" aria-label="Editar aluno">✎</button>`,
  });
  $('#editar-aluno').onclick = () => modalAluno(a);
  $('#novo-reg').onclick = () => modalRegistro(id);
  $$('[data-reg]').forEach(b => b.onclick = () => modalRegistro(id, db.registros.find(r => r.id === b.dataset.reg)));
  $$('.nivel').forEach(b => b.onclick = () => {
    const area = b.closest('.desenv-linha').dataset.area;
    const v = +b.dataset.v;
    const porBim = (db.desenv[id] ||= {})[bim] ||= {};
    if (porBim[area] === v) delete porBim[area]; else porBim[area] = v;
    salvar();
    rotear();
  });
}

function modalAluno(a) {
  abrirModal('Editar aluno',
    campo('Nome', 'nome', a.nome)
    + `<div class="duas">${campo('Nº da chamada', 'numero', a.numero || '', 'number', 'min="1"')}
      ${campoSelect('Turma', 'turmaId', [...db.turmas].sort(porNome).map(t => [t.id, t.nome]), a.turmaId)}</div>`
    + campoTexto('Observações gerais (só sobre a aprendizagem)', 'obs', a.obs || '', 3),
    [
      {
        texto: 'Excluir', classe: 'perigo-texto esq', acao: () => confirmar(
          `Excluir ${a.nome} com notas, chamadas e anotações? Isso não pode ser desfeito.`, 'Excluir', () => {
            apagarDadosAluno(a.id);
            db.alunos = db.alunos.filter(x => x.id !== a.id);
            salvar();
            toast('Aluno excluído');
            location.replace(`#/turma/${a.turmaId}`);
          }),
      },
      { texto: 'Cancelar' },
      {
        texto: 'Salvar', classe: 'primario', acao: m => {
          const d = lerForm(m);
          if (!d.nome) { toast('O nome não pode ficar vazio'); return false; }
          Object.assign(a, { nome: d.nome, numero: parseInt(d.numero) || null, turmaId: d.turmaId, obs: d.obs });
          salvar();
          rotear();
        },
      },
    ]);
}

function modalRegistro(alunoId, r) {
  const editando = !!r;
  abrirModal(editando ? 'Editar anotação' : 'Nova anotação',
    `<div class="duas">${campoSelect('Tipo', 'tipo', Object.entries(TIPOS_REGISTRO), r?.tipo || 'dificuldade')}
      ${campo('Data', 'data', r?.data || hoje(), 'date')}</div>`
    + campoSelect('Área', 'area', [['', '—'], ...db.config.areas], r?.area || '')
    + campoTexto('O que você observou', 'texto', r?.texto || '', 4, 'placeholder="Ex.: Lê silabando, troca p/b na escrita..."'),
    [
      ...(editando ? [{
        texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
          db.registros = db.registros.filter(x => x.id !== r.id);
          salvar();
          rotear();
        },
      }] : []),
      { texto: 'Cancelar' },
      {
        texto: 'Salvar', classe: 'primario', acao: m => {
          const d = lerForm(m);
          if (!d.texto) { toast('Escreva a anotação'); return false; }
          if (!d.data) d.data = hoje();
          if (editando) Object.assign(r, d);
          else db.registros.push({ id: novoId(), alunoId, ...d });
          salvar();
          rotear();
        },
      },
    ]);
}

function telaRelatorio(id) {
  const a = aluno(id);
  if (!a) { location.replace('#/turmas'); return; }
  const t = turma(a.turmaId), c = db.config, fr = frequencia(id);
  const regs = db.registros.filter(r => r.alunoId === id).sort((x, y) => x.data.localeCompare(y.data));
  const nivelNome = v => NIVEIS.find(n => n.v === v)?.nome || '—';

  const html = `<div class="relatorio">
    <header class="rel-cab">
      <h2>Relatório individual do aluno</h2>
      ${c.escola || t?.escola ? `<p>${esc(c.escola || t.escola)}</p>` : ''}
      <p>Professor(a): ${esc(c.professor || '—')} · Ano letivo ${esc(c.anoLetivo)}</p>
    </header>
    <table class="rel-dados">
      <tr><th>Aluno(a)</th><td>${esc(a.nome)}</td></tr>
      <tr><th>Turma</th><td>${esc(t?.nome || '')}${t?.turno ? ' — ' + esc(t.turno) : ''}</td></tr>
      <tr><th>Frequência</th><td>${fr.total
        ? `${Math.round(fr.pct)}% — ${plural(fr.p, 'presença', 'presenças')}, ${plural(fr.f, 'falta', 'faltas')}, ${plural(fr.j, 'justificada', 'justificadas')} em ${plural(fr.total, 'dia letivo', 'dias letivos')}`
        : 'Sem registro de chamada'}</td></tr>
    </table>
    <h3>Notas (0 a 10)</h3>${tabelaNotasAluno(a)}
    <h3>Desenvolvimento</h3>
    <div class="tabela-rolagem"><table><thead><tr><th>Área</th>${[1, 2, 3, 4].map(b => `<th>${b}º</th>`).join('')}</tr></thead>
      <tbody>${c.areas.map(ar => `<tr><td>${esc(ar)}</td>${[1, 2, 3, 4].map(b =>
        `<td>${nivelNome(db.desenv[id]?.[b]?.[ar])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${regs.length ? `<h3>Anotações pedagógicas</h3><ul>${regs.map(r =>
      `<li><b>${fmtData(r.data)} — ${TIPOS_REGISTRO[r.tipo]}${r.area ? ' (' + esc(r.area) + ')' : ''}:</b> ${esc(r.texto)}</li>`).join('')}</ul>` : ''}
    ${a.obs ? `<h3>Observações gerais</h3><p style="white-space:pre-wrap">${esc(a.obs)}</p>` : ''}
    <div class="assinatura"><div>Professor(a)</div><div>Coordenação</div><div>Responsável</div></div>
    <p class="legenda" style="text-align:right">Gerado em ${fmtData(hoje())}</p>
  </div>
  <button class="btn primario largo nao-imprimir" id="imprimir">Imprimir ou salvar em PDF</button>`;
  render('Relatório', html, { voltar: `/aluno/${id}` });
  $('#imprimir').onclick = () => imprimir(`Relatório - ${a.nome}`);
}

/* ---------- Aulas ---------- */

function itemAula(a, comData = false) {
  const dada = a.status === 'dada';
  const sub = [comData ? fmtDia(a.data) : '', nomeTurma(a.turmaId), a.disciplina].filter(Boolean).map(esc).join(' · ');
  return `<a class="item" href="#/aula/${a.id}"><div><strong>${esc(a.tema || '(aula sem tema)')}</strong>
    <div class="sub">${sub}</div></div><span class="selo ${dada ? 'ok' : ''}">${dada ? 'Dada' : 'Planejada'}</span></a>`;
}

function agruparPorData(lista, fnItem) {
  const grupos = new Map();
  lista.forEach(x => { if (!grupos.has(x.data)) grupos.set(x.data, []); grupos.get(x.data).push(x); });
  return [...grupos].map(([d, itens]) => `<div class="grupo"><div class="grupo-data">${fmtDia(d)}</div>
    <div class="lista">${itens.map(x => fnItem(x)).join('')}</div></div>`).join('');
}

function telaAulas(params) {
  if (!db.turmas.length) {
    render('Aulas', vazio('Crie uma turma antes de planejar aulas. <a href="#/turmas">Ir para turmas</a>'));
    return;
  }
  const filtro = params.get('turma') || '';
  const h = hoje();
  const aulas = db.aulas.filter(a => !filtro || a.turmaId === filtro);
  const futuras = aulas.filter(a => a.data >= h).sort((x, y) => x.data.localeCompare(y.data));
  const passadas = aulas.filter(a => a.data < h).sort((x, y) => y.data.localeCompare(x.data));
  let html = '';
  if (db.turmas.length > 1) {
    html += `<div class="chips">${[['', 'Todas'], ...[...db.turmas].sort(porNome).map(t => [t.id, t.nome])].map(([v, n]) =>
      `<a class="chip mini ${v === filtro ? 'on' : ''}" href="#/aulas${v ? '?turma=' + v : ''}">${esc(n)}</a>`).join('')}</div>`;
  }
  html += `<button class="btn primario largo" data-ir="#/aula/nova${filtro ? '?turma=' + filtro : ''}">+ Planejar aula</button>`;
  html += `<h3 class="secao">Próximas</h3>` + (futuras.length ? agruparPorData(futuras, a => itemAula(a)) : vazio('Nenhuma aula planejada daqui para frente.'));
  if (passadas.length) html += `<h3 class="secao">Anteriores</h3>` + agruparPorData(passadas, a => itemAula(a));
  render('Aulas', html);
}

function telaAula(id, params) {
  if (!db.turmas.length) {
    render('Planejar aula', vazio('Crie uma turma antes de planejar aulas. <a href="#/turmas">Ir para turmas</a>'), { voltar: '/aulas' });
    return;
  }
  const nova = id === 'nova';
  const a = nova
    ? { turmaId: params.get('turma') || [...db.turmas].sort(porNome)[0].id, data: params.get('data') || hoje(), status: 'planejada' }
    : db.aulas.find(x => x.id === id);
  if (!a) { location.replace('#/aulas'); return; }

  const html = `<form id="form-aula" class="form">
    ${campoSelect('Turma', 'turmaId', [...db.turmas].sort(porNome).map(t => [t.id, t.nome]), a.turmaId)}
    <div class="duas">${campo('Data', 'data', a.data, 'date')}
      ${campoSelect('Situação', 'status', [['planejada', 'Planejada'], ['dada', 'Aula dada']], a.status)}</div>
    ${campoSelect('Disciplina', 'disciplina', opcoesDisciplina(a.disciplina), a.disciplina || '')}
    ${campo('Tema da aula', 'tema', a.tema || '', 'text', 'placeholder="Ex.: Frações equivalentes"')}
    ${campoTexto('Habilidades da BNCC', 'bncc', a.bncc || '', 2, 'placeholder="Ex.: EF04MA09"')}
    ${campoTexto('Objetivos', 'objetivos', a.objetivos || '', 3, 'placeholder="O que os alunos devem aprender"')}
    ${campoTexto('Conteúdo', 'conteudo', a.conteudo || '', 3)}
    ${campoTexto('Desenvolvimento da aula', 'metodologia', a.metodologia || '', 5, 'placeholder="Passo a passo: início, meio e fim"')}
    ${campoTexto('Recursos e materiais', 'recursos', a.recursos || '', 2, 'placeholder="Livro p. 45, cartolina, vídeo..."')}
    ${campoTexto('Avaliação', 'avaliacao', a.avaliacao || '', 2, 'placeholder="Como vou saber se aprenderam"')}
    ${campoTexto('Como foi a aula (preencher depois)', 'reflexao', a.reflexao || '', 3, 'placeholder="O que funcionou, o que mudar, quem teve dificuldade"')}
    <button type="submit" class="btn primario largo">Salvar aula</button>
    ${nova ? '' : `<div class="linha-botoes"><button type="button" class="btn" id="dup-aula">Duplicar para outro dia/turma</button>
      <button type="button" class="btn perigo-texto" id="exc-aula">Excluir</button></div>`}
  </form>`;
  render(nova ? 'Planejar aula' : 'Aula', html, { voltar: '/aulas' });

  const form = $('#form-aula');
  form.oninput = () => { formSujo = true; };
  form.onsubmit = e => {
    e.preventDefault();
    const d = lerForm(form);
    if (!d.data) { toast('Informe a data'); return; }
    formSujo = false;
    if (nova) {
      const n = { id: novoId(), ...d, criadoEm: hoje() };
      db.aulas.push(n);
      salvar();
      toast('Aula salva');
      location.replace(`#/aula/${n.id}`);
    } else {
      Object.assign(a, d);
      salvar();
      toast('Aula salva');
    }
  };
  if (nova) return;
  $('#exc-aula').onclick = () => confirmar('Excluir esta aula?', 'Excluir', () => {
    db.aulas = db.aulas.filter(x => x.id !== a.id);
    salvar();
    formSujo = false;
    location.replace('#/aulas');
  });
  $('#dup-aula').onclick = () => abrirModal('Duplicar aula',
    campoSelect('Para a turma', 'turmaId', [...db.turmas].sort(porNome).map(t => [t.id, t.nome]), a.turmaId)
    + campo('Na data', 'data', somaDias(a.data, 7), 'date'),
    [{ texto: 'Cancelar' }, {
      texto: 'Duplicar', classe: 'primario', acao: m => {
        const d = lerForm(m);
        const copia = { ...a, ...lerForm(form), id: novoId(), turmaId: d.turmaId, data: d.data || hoje(), status: 'planejada', reflexao: '', criadoEm: hoje() };
        db.aulas.push(copia);
        salvar();
        toast('Aula duplicada');
        formSujo = false;
        ir(`#/aula/${copia.id}`);
      },
    }]);
}

/* ---------- Agenda ---------- */

function ordemEvento(a, b) { return a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99'); }

function itemEvento(e, comData = false) {
  const sub = [comData ? fmtDia(e.data) : '', e.hora, e.tipo, e.turmaId ? nomeTurma(e.turmaId) : ''].filter(Boolean).map(esc).join(' · ');
  return `<div class="item evento ${e.feito ? 'feito' : ''}">
    <input type="checkbox" class="check" data-feito="${e.id}" ${e.feito ? 'checked' : ''} aria-label="Marcar como feito">
    <div class="cresce" data-ev="${e.id}"><strong>${esc(e.titulo)}</strong><div class="sub">${sub}</div>
    ${e.obs ? `<div class="sub">${esc(e.obs)}</div>` : ''}</div></div>`;
}

function ligarEventos(raiz) {
  $$('[data-feito]', raiz).forEach(cb => cb.onchange = () => {
    const ev = db.eventos.find(x => x.id === cb.dataset.feito);
    ev.feito = cb.checked;
    salvar();
    if (cb.checked) toast('Feito!');
    setTimeout(rotear, 250);
  });
  $$('[data-ev]', raiz).forEach(el => el.onclick = () => modalEvento(db.eventos.find(x => x.id === el.dataset.ev)));
}

function telaAgenda() {
  const h = hoje();
  const pendentes = db.eventos.filter(e => !e.feito);
  const atrasados = pendentes.filter(e => e.data < h).sort(ordemEvento);
  const proximos = pendentes.filter(e => e.data >= h).sort(ordemEvento);
  const feitos = db.eventos.filter(e => e.feito).sort((x, y) => y.data.localeCompare(x.data)).slice(0, 30);
  let html = `<button class="btn primario largo" id="novo-ev">+ Novo lembrete</button>`;
  if (atrasados.length) html += `<h3 class="secao ruim">Pendentes de dias anteriores</h3>${agruparPorData(atrasados, e => itemEvento(e))}`;
  html += `<h3 class="secao">Próximos</h3>` + (proximos.length ? agruparPorData(proximos, e => itemEvento(e)) : vazio('Nenhum compromisso marcado.'));
  if (feitos.length) html += `<details class="feitos"><summary>Concluídos (${feitos.length})</summary>
    <div class="lista">${feitos.map(e => itemEvento(e, true)).join('')}</div></details>`;
  render('Agenda', html);
  $('#novo-ev').onclick = () => modalEvento();
  ligarEventos($('#tela'));
}

function modalEvento(ev) {
  const editando = !!ev;
  abrirModal(editando ? 'Editar lembrete' : 'Novo lembrete',
    campo('O quê', 'titulo', ev?.titulo || '', 'text', 'placeholder="Ex.: Prova de Matemática"')
    + `<div class="duas">${campo('Data', 'data', ev?.data || hoje(), 'date')}${campo('Hora (opcional)', 'hora', ev?.hora || '', 'time')}</div>`
    + `<div class="duas">${campoSelect('Tipo', 'tipo', TIPOS_EVENTO, ev?.tipo || 'Lembrete')}
      ${campoSelect('Turma', 'turmaId', [['', '—'], ...[...db.turmas].sort(porNome).map(t => [t.id, t.nome])], ev?.turmaId || '')}</div>`
    + campoTexto('Observação', 'obs', ev?.obs || '', 2),
    [
      ...(editando ? [{
        texto: 'Excluir', classe: 'perigo-texto esq', acao: () => {
          db.eventos = db.eventos.filter(x => x.id !== ev.id);
          salvar();
          rotear();
        },
      }] : []),
      { texto: 'Cancelar' },
      {
        texto: 'Salvar', classe: 'primario', acao: m => {
          const d = lerForm(m);
          if (!d.titulo) { toast('Escreva o lembrete'); return false; }
          if (!d.data) { toast('Informe a data'); return false; }
          if (editando) Object.assign(ev, d);
          else db.eventos.push({ id: novoId(), ...d, feito: false });
          salvar();
          toast('Lembrete salvo');
          rotear();
        },
      },
    ]);
}

/* ---------- Mais / configurações ---------- */

function telaConfig() {
  const c = db.config;
  const html = `<form id="form-config" class="cartao">
      <h3>Seus dados</h3>
      ${campo('Seu nome', 'professor', c.professor, 'text', 'placeholder="Como quer ser chamado(a)"')}
      ${campo('Escola', 'escola', c.escola)}
      ${campo('Ano letivo', 'anoLetivo', c.anoLetivo, 'number')}
      ${campoTexto('Disciplinas (uma por linha)', 'disciplinas', c.disciplinas.join('\n'), 5)}
      ${campoTexto('Áreas de desenvolvimento acompanhadas (uma por linha)', 'areas', c.areas.join('\n'), 5)}
      <p class="legenda">Se você renomear uma área, o que já foi marcado na área antiga não aparece na nova.</p>
      <button class="btn primario largo" type="submit">Salvar</button>
    </form>
    <div class="cartao">
      <h3>Cópia de segurança</h3>
      <p>Seus dados ficam guardados <b>somente neste aparelho</b>. Se o celular quebrar, for trocado ou o app for
      desinstalado, eles se perdem. Salve uma cópia de vez em quando e guarde no Google Drive, WhatsApp, e-mail ou pendrive.</p>
      <p class="sub">Última cópia: ${c.ultimoBackup ? fmtData(c.ultimoBackup) : 'nunca'}</p>
      <div class="linha-botoes"><button class="btn primario" id="exportar">Salvar cópia</button>
        <button class="btn" id="importar">Restaurar cópia</button></div>
    </div>
    <div class="cartao">
      <h3>Dados</h3>
      <p class="sub">${plural(db.turmas.length, 'turma', 'turmas')} · ${plural(db.alunos.length, 'aluno', 'alunos')} · ${plural(db.aulas.length, 'aula', 'aulas')}</p>
      <div class="linha-botoes">
        ${db.turmas.length ? '' : '<button class="btn" id="exemplo">Carregar dados de exemplo</button>'}
        <button class="btn perigo-texto" id="apagar">Apagar todos os dados</button>
      </div>
    </div>
    <div class="cartao sobre">
      <img class="logo-sobre" src="logo.webp" alt="Logo EG Gamer X">
      <p><b>Caderno do Professor</b> · versão ${VERSAO_APP}</p>
      <p>Desenvolvido por <b>EG Gamer X</b></p>
      <p class="sub">Funciona 100% offline. O app não usa internet e não envia nenhum dado para fora do aparelho.</p>
    </div>`;
  render('Mais', html);

  $('#form-config').onsubmit = e => {
    e.preventDefault();
    const d = lerForm(e.target);
    c.professor = d.professor;
    c.escola = d.escola;
    c.anoLetivo = parseInt(d.anoLetivo) || c.anoLetivo;
    if (linhas(d.disciplinas).length) c.disciplinas = linhas(d.disciplinas);
    if (linhas(d.areas).length) c.areas = linhas(d.areas);
    salvar();
    toast('Configurações salvas');
    rotear();
  };
  $('#exportar').onclick = () => {
    const texto = JSON.stringify({ app: 'caderno-do-professor', versao: VERSAO_APP, exportadoEm: new Date().toISOString(), dados: db });
    salvarArquivo(`caderno-professor-copia-${hoje()}.json`, texto, 'application/json', ok => {
      if (!ok) return;
      c.ultimoBackup = hoje();
      salvar();
      if (location.hash === '#/config') rotear();
    });
  };
  $('#importar').onclick = () => abrirArquivo(texto => {
    let obj;
    try { obj = JSON.parse(texto); } catch { toast('Arquivo inválido'); return; }
    const dados = obj?.dados || obj;
    if (!dados || !Array.isArray(dados.turmas) || !dados.config) { toast('Este arquivo não é uma cópia do Caderno do Professor'); return; }
    const quando = obj.exportadoEm ? ` de ${fmtData(isoLocal(new Date(obj.exportadoEm)))}` : '';
    confirmar(`Restaurar a cópia${quando} com ${plural(dados.turmas.length, 'turma', 'turmas')} e ${plural((dados.alunos || []).length, 'aluno', 'alunos')}? Os dados atuais deste aparelho serão substituídos.`,
      'Restaurar', () => {
        db = normalizar(dados);
        salvar();
        toast('Cópia restaurada');
        ir('#/');
      }, false);
  });
  $('#exemplo')?.addEventListener('click', carregarExemplo);
  $('#apagar').onclick = () => abrirModal('Apagar todos os dados',
    `<p>Isso apaga <b>todas</b> as turmas, alunos, notas, chamadas, aulas e lembretes deste aparelho.
     Faça uma cópia de segurança antes se quiser guardar.</p>${campo('Digite APAGAR para confirmar', 'conf', '', 'text', 'autocomplete="off"')}`,
    [{ texto: 'Cancelar' }, {
      texto: 'Apagar tudo', classe: 'perigo', acao: m => {
        if (lerForm(m).conf.toUpperCase() !== 'APAGAR') { toast('Digite APAGAR para confirmar'); return false; }
        db = bancoVazio();
        salvar();
        toast('Dados apagados');
        ir('#/');
      },
    }]);
}

/* ---------- Dados de exemplo ---------- */

function carregarExemplo() {
  const h = hoje(), b = bimestreAtual();
  const t = { id: novoId(), nome: '4º ano B', turno: 'Tarde', escola: '', criadoEm: h };
  db.turmas.push(t);
  const nomes = ['Ana Clara Souza', 'Arthur Lima', 'Beatriz Santos', 'Davi Oliveira', 'Enzo Fernandes',
    'Helena Costa', 'Lucas Pereira', 'Maria Eduarda Rocha', 'Miguel Almeida', 'Sofia Ribeiro'];
  const als = nomes.map((nome, i) => ({ id: novoId(), turmaId: t.id, nome, numero: i + 1, obs: '' }));
  db.alunos.push(...als);
  const [, , , davi, enzo, helena] = als;

  // Chamada dos últimos 10 dias úteis
  for (let d = h, dias = 0; dias < 10;) {
    d = somaDias(d, -1);
    const sem = dataDe(d).getDay();
    if (sem === 0 || sem === 6) continue;
    const reg = {};
    als.forEach((a, i) => { reg[a.id] = (i * 7 + dias * 3) % 13 === 0 ? 'F' : (i + dias) % 17 === 0 ? 'J' : 'P'; });
    db.chamadas[`${t.id}|${d}`] = reg;
    dias++;
  }

  // Avaliações e notas
  const base = [8.5, 7, 9.5, 5.5, 5, 8, 7.5, 9, 6, 8];
  const bims = b > 1 ? [b - 1, b] : [b];
  bims.forEach((bi, k) => {
    [['Prova 1', 'Matemática', 10], ['Leitura em voz alta', 'Língua Portuguesa', 10], ['Trabalho em grupo', 'Ciências', 5]]
      .forEach(([titulo, disciplina, valorMax], j) => {
        const av = { id: novoId(), turmaId: t.id, titulo, disciplina, bimestre: bi, valorMax, data: somaDias(h, -20 * (bims.length - k) + j * 3) };
        db.avaliacoes.push(av);
        db.notas[av.id] = {};
        als.forEach((a, i) => {
          let n = base[i] + ((i + j + k) % 3 - 1) * 0.5 + k * 0.5;
          if (a === enzo && disciplina === 'Língua Portuguesa') n -= 1.5;
          n = Math.max(0, Math.min(10, n));
          db.notas[av.id][a.id] = Math.round(n * valorMax) / 10;
        });
      });
  });

  // Desenvolvimento
  const areas = db.config.areas;
  als.forEach((a, i) => {
    db.desenv[a.id] = {};
    bims.forEach((bi, k) => {
      db.desenv[a.id][bi] = {};
      areas.forEach((ar, j) => {
        let v = Math.min(4, Math.max(1, Math.round(base[i] / 2.5) + ((i + j) % 3 === 0 ? -1 : 0) + k));
        if (a === enzo && (ar === 'Leitura' || ar === 'Escrita')) v = k ? 2 : 1;
        if (a === davi && ar === 'Matemática') v = 1;
        db.desenv[a.id][bi][ar] = Math.min(4, v);
      });
    });
  });

  db.registros.push(
    { id: novoId(), alunoId: enzo.id, tipo: 'dificuldade', area: 'Leitura', data: somaDias(h, -12), texto: 'Lê silabando. Ainda tem dificuldade com dígrafos (ch, lh, nh).' },
    { id: novoId(), alunoId: enzo.id, tipo: 'avanco', area: 'Participação', data: somaDias(h, -3), texto: 'Participou bem da roda de leitura e pediu para ler em voz alta.' },
    { id: novoId(), alunoId: davi.id, tipo: 'dificuldade', area: 'Matemática', data: somaDias(h, -5), texto: 'Confunde multiplicação e divisão nos problemas.' },
    { id: novoId(), alunoId: helena.id, tipo: 'observacao', area: 'Socialização', data: somaDias(h, -2), texto: 'Ajuda os colegas nas atividades em grupo.' },
  );

  db.aulas.push(
    { id: novoId(), turmaId: t.id, data: somaDias(h, -1), status: 'dada', disciplina: 'Matemática', tema: 'Frações: metade, terço e quarto', bncc: 'EF04MA09', objetivos: 'Reconhecer frações unitárias usando figuras.', conteudo: 'Frações unitárias', metodologia: '1. Dobradura de papel em partes iguais\n2. Registro no caderno\n3. Exercícios do livro', recursos: 'Folhas coloridas, livro p. 112', avaliacao: 'Observação e correção dos exercícios', reflexao: 'A dobradura funcionou muito bem. Davi e Lucas precisam de reforço.', criadoEm: h },
    { id: novoId(), turmaId: t.id, data: h, status: 'planejada', disciplina: 'Língua Portuguesa', tema: 'Leitura de fábulas', bncc: 'EF04LP03', objetivos: 'Ler e compreender fábulas, identificando a moral da história.', conteudo: 'Gênero textual fábula', metodologia: '1. Leitura compartilhada de "A cigarra e a formiga"\n2. Conversa sobre a moral\n3. Ilustração da fábula', recursos: 'Livro de fábulas, lápis de cor', avaliacao: 'Participação na conversa e ilustração', reflexao: '', criadoEm: h },
    { id: novoId(), turmaId: t.id, data: somaDias(h, 1), status: 'planejada', disciplina: 'Ciências', tema: 'Cadeia alimentar', bncc: 'EF04CI04', objetivos: 'Entender produtores, consumidores e decompositores.', conteudo: 'Cadeia alimentar', metodologia: 'Montar uma cadeia alimentar com cartões no quadro.', recursos: 'Cartões com animais e plantas', avaliacao: 'Atividade em dupla', reflexao: '', criadoEm: h },
  );

  db.eventos.push(
    { id: novoId(), titulo: 'Prova de Matemática', data: somaDias(h, 3), hora: '13:30', tipo: 'Prova', turmaId: t.id, obs: 'Frações e multiplicação', feito: false },
    { id: novoId(), titulo: 'Reunião de pais', data: somaDias(h, 5), hora: '18:00', tipo: 'Reunião', turmaId: t.id, obs: '', feito: false },
    { id: novoId(), titulo: 'Entregar notas na secretaria', data: somaDias(h, 12), hora: '', tipo: 'Entrega de notas', turmaId: '', obs: '', feito: false },
  );

  salvar();
  toast('Exemplo carregado. Pode apagar depois em Mais.');
  ir('#/');
}

/* ---------- Início ---------- */

$('#btn-voltar').onclick = voltar;
window.addEventListener('hashchange', rotear);
rotear();
