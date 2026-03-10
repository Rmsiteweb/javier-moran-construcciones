// ─── DATA STORAGE ───
let presupuestos = JSON.parse(localStorage.getItem('jmc_presupuestos') || '[]');
let clientes     = JSON.parse(localStorage.getItem('jmc_clientes')     || '[]');
let blogPosts    = JSON.parse(localStorage.getItem('jmc_blog')         || '[]');
let ivaOn        = false;
let items        = [];
let pendingImages = [];
let editingClientId = null;
let editingPresId   = null;

// ─── AUTH ───
const PRIVATE_PASS = 'aguante el globo'; // ← Contraseña
let sesionActiva = false;
let pendingSection = null;

function requestPrivate(section) {
  if (sesionActiva) { showSection(section); return; }
  pendingSection = section;
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginErr').textContent = '';
  document.getElementById('loginOverlay').classList.add('open');
  setTimeout(() => document.getElementById('loginPassword').focus(), 100);
}

function doLogin() {
  const pw = document.getElementById('loginPassword').value;
  if (pw === PRIVATE_PASS) {
    sesionActiva = true;
    document.getElementById('loginOverlay').classList.remove('open');
    actualizarNavSesion();
    if (pendingSection) { showSection(pendingSection); pendingSection = null; }
    document.getElementById('logoUploadHint').style.display = 'block';
    toast('Sesión iniciada correctamente');
  } else {
    const inp = document.getElementById('loginPassword');
    inp.classList.add('error');
    document.getElementById('loginErr').textContent = 'Contraseña incorrecta. Intentá de nuevo.';
    setTimeout(() => inp.classList.remove('error'), 500);
    inp.value = '';
    inp.focus();
  }
}

function closeLogin() {
  document.getElementById('loginOverlay').classList.remove('open');
  pendingSection = null;
}

function cerrarSesion() {
  sesionActiva = false;
  actualizarNavSesion();
  showSection('hero');
  document.getElementById('logoUploadHint').style.display = 'none';
  toast('Sesión cerrada');
}

function togglePwVis() {
  const inp = document.getElementById('loginPassword');
  const ico = document.getElementById('togglePwIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    ico.className = 'fas fa-eye-slash';
  } else {
    inp.type = 'password';
    ico.className = 'fas fa-eye';
  }
}

function actualizarNavSesion() {
  const privateButtons = document.getElementById('nav-private-buttons');
  const sessionButtons = document.getElementById('nav-session');
  if (sesionActiva) {
    privateButtons.style.display = 'none';
    sessionButtons.style.display = 'flex';
  } else {
    privateButtons.style.display = 'flex';
    sessionButtons.style.display = 'none';
  }
}

// ─── NAVIGATION ───
const PUBLIC_SECTIONS  = ['hero','blog','contacto'];
const PRIVATE_SECTIONS = ['presupuestos','agenda','fotos'];

function showSection(id) {
  // Guard privado
  if (PRIVATE_SECTIONS.includes(id) && !sesionActiva) {
    requestPrivate(id); return;
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  // Actualizar nav activo
  const navMap = { hero:'nav-hero', contacto:'nav-contacto' };
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  if (navMap[id]) {
    const btn = document.getElementById(navMap[id]);
    if (btn) btn.classList.add('active');
  }

  if (id === 'presupuestos') { renderPresupuestos(); if (!items.length) addItem(); }
  if (id === 'agenda')       { renderClientes(); }
  if (id === 'blog')         { renderBlog(); }
  if (id === 'fotos')        { renderFotos(); }
  const fd = document.getElementById('p-fecha');
  if (fd && !fd.value) fd.value = new Date().toISOString().split('T')[0];
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'historial') renderPresupuestos();
}

// ─── TOAST ───
function toast(msg, type='ok') {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.style.borderColor = type==='ok' ? 'var(--sand)' : '#ff6b6b';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── LOGO UPLOAD ───
function uploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('logoImg');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('logoInitials').style.display = 'none';
    localStorage.setItem('jmc_logo', e.target.result);
    toast('¡Logo actualizado!');
  };
  reader.readAsDataURL(file);
}

// Load saved logo
(function() {
  const saved = localStorage.getItem('jmc_logo');
  if (saved) {
    const img = document.getElementById('logoImg');
    img.src = saved; img.style.display = 'block';
    document.getElementById('logoInitials').style.display = 'none';
  }
})();

// ─── IVA ───
function toggleIva() {
  ivaOn = !ivaOn;
  document.getElementById('ivaToggle').classList.toggle('on', ivaOn);
  document.getElementById('iva-row').style.display = ivaOn ? 'flex' : 'none';
  calcTotals();
}

// ─── ITEMS ───
function addItem(desc='', cant='', precio='') {
  const id = Date.now() + Math.random();
  items.push({ id, desc, cant, precio });
  renderItems();
}

function removeItem(id) {
  items = items.filter(i => i.id !== id);
  renderItems();
  calcTotals();
}

function renderItems() {
  const c = document.getElementById('items-container');
  c.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `
      <input type="text" placeholder="Descripción del trabajo/material" value="${item.desc}"
        oninput="updateItem(${item.id},'desc',this.value)">
      <input type="number" placeholder="1" value="${item.cant}" min="0"
        oninput="updateItem(${item.id},'cant',this.value);calcTotals()">
      <input type="number" placeholder="0.00" value="${item.precio}" min="0" step="0.01"
        oninput="updateItem(${item.id},'precio',this.value);calcTotals()">
      <input type="text" readonly value="${fmtMoney((item.cant||0)*(item.precio||0))}" id="sub-${item.id}">
      <button class="btn-remove" onclick="removeItem(${item.id})"><i class="fas fa-times"></i></button>
    `;
    c.appendChild(row);
  });
}

function updateItem(id, field, val) {
  const item = items.find(i => i.id === id);
  if (item) {
    item[field] = val;
    const sub = document.getElementById('sub-' + id);
    if (sub) sub.value = fmtMoney((item.cant||0)*(item.precio||0));
  }
}

function calcTotals() {
  const sub = items.reduce((s, i) => s + (parseFloat(i.cant)||0)*(parseFloat(i.precio)||0), 0);
  const iva = ivaOn ? sub * 0.21 : 0;
  const total = sub + iva;
  document.getElementById('t-subtotal').textContent = fmtMoney(sub);
  document.getElementById('t-iva').textContent = fmtMoney(iva);
  document.getElementById('t-total').textContent = fmtMoney(total);
}

function fmtMoney(n) {
  return '$ ' + (parseFloat(n)||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

// ─── GUARDAR PRESUPUESTO ───
function guardarPresupuesto() {
  const cliente = document.getElementById('p-cliente').value.trim();
  const fecha   = document.getElementById('p-fecha').value;
  const obra    = document.getElementById('p-obra').value.trim();
  if (!cliente) { toast('Ingresá el nombre del cliente','err'); return; }
  if (!obra)    { toast('Ingresá la descripción de la obra','err'); return; }

  const sub   = items.reduce((s,i) => s + (parseFloat(i.cant)||0)*(parseFloat(i.precio)||0), 0);
  const iva   = ivaOn ? sub*0.21 : 0;
  const total = sub + iva;

  const pres = {
    id:        editingPresId || Date.now(),
    cliente,  fecha, obra,
    direccion: document.getElementById('p-direccion').value,
    notas:     document.getElementById('p-notas').value,
    estado:    document.getElementById('p-estado').value,
    items:     JSON.parse(JSON.stringify(items)),
    ivaOn, sub, iva, total,
    creado:    new Date().toLocaleDateString('es-AR')
  };

  if (editingPresId) {
    const idx = presupuestos.findIndex(p => p.id === editingPresId);
    if (idx >= 0) presupuestos[idx] = pres;
    editingPresId = null;
  } else {
    presupuestos.unshift(pres);
  }

  localStorage.setItem('jmc_presupuestos', JSON.stringify(presupuestos));
  toast('Presupuesto guardado correctamente');
  limpiarPresupuesto();
  switchTabDirect('historial');
}

function switchTabDirect(name) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', i===(name==='nuevo'?0:1)));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'historial') renderPresupuestos();
}

function limpiarPresupuesto() {
  document.getElementById('p-cliente').value = '';
  document.getElementById('p-obra').value = '';
  document.getElementById('p-direccion').value = '';
  document.getElementById('p-notas').value = '';
  document.getElementById('p-estado').value = 'pendiente';
  document.getElementById('p-fecha').value = new Date().toISOString().split('T')[0];
  items = [];
  editingPresId = null;
  addItem();
  calcTotals();
}

// ─── RENDER PRESUPUESTOS ───
function renderPresupuestos() {
  const list = document.getElementById('presupuestos-list');
  const count = document.getElementById('pres-count');
  count.textContent = presupuestos.length + ' presupuesto' + (presupuestos.length!==1?'s':'') + ' guardado' + (presupuestos.length!==1?'s':'');

  if (!presupuestos.length) {
    list.innerHTML = '<div class="empty-state"><i class="fas fa-file-invoice-dollar"></i><p>No hay presupuestos aún.<br>Creá el primero.</p></div>';
    return;
  }

  list.innerHTML = presupuestos.map(p => `
    <div class="presupuesto-card">
      <div class="info">
        <h4>${p.cliente}</h4>
        <span>${p.obra} · ${p.fecha||''} · <span class="estado-badge estado-${p.estado}">${p.estado}</span></span>
      </div>
      <div style="text-align:right">
        <div class="amount">${fmtMoney(p.total)}</div>
        <div style="display:flex;gap:0.5rem;margin-top:0.5rem;justify-content:flex-end">
          <button class="btn-icon edit" title="Editar" onclick="editarPresupuesto(${p.id})"><i class="fas fa-edit"></i></button>
          <div class="export-dropdown" style="position:relative">
            <button class="btn-icon" title="Exportar" style="color:var(--sand);border:1px solid rgba(201,169,110,0.25)"><i class="fas fa-file-export"></i></button>
            <div class="exp-menu" style="right:0;top:calc(100% + 4px)">
              <button onclick="exportarPresupuestoExcelById(${p.id})"><i class="fas fa-file-excel ico-xl"></i> Excel</button>
              <div class="exp-sep"></div>
              <button onclick="exportarPresupuestoPDFById(${p.id})"><i class="fas fa-file-pdf ico-pdf"></i> PDF</button>
            </div>
          </div>
          <button class="btn-icon delete" title="Eliminar" onclick="eliminarPresupuesto(${p.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    </div>
  `).join('');
}

function editarPresupuesto(id) {
  const p = presupuestos.find(x => x.id === id);
  if (!p) return;
  editingPresId = id;
  document.getElementById('p-cliente').value   = p.cliente;
  document.getElementById('p-fecha').value     = p.fecha;
  document.getElementById('p-obra').value      = p.obra;
  document.getElementById('p-direccion').value = p.direccion||'';
  document.getElementById('p-notas').value     = p.notas||'';
  document.getElementById('p-estado').value    = p.estado;
  items = JSON.parse(JSON.stringify(p.items));
  ivaOn = p.ivaOn;
  document.getElementById('ivaToggle').classList.toggle('on', ivaOn);
  document.getElementById('iva-row').style.display = ivaOn ? 'flex' : 'none';
  renderItems(); calcTotals();
  switchTabDirect('nuevo');
}

function eliminarPresupuesto(id) {
  if (!confirm('¿Eliminar este presupuesto?')) return;
  presupuestos = presupuestos.filter(p => p.id !== id);
  localStorage.setItem('jmc_presupuestos', JSON.stringify(presupuestos));
  renderPresupuestos();
  toast('Presupuesto eliminado');
}

// ─── EXPORT EXCEL PRESUPUESTO ───
function exportarPresupuestoExcel() {
  const cliente = document.getElementById('p-cliente').value.trim() || 'Cliente';
  const obra    = document.getElementById('p-obra').value.trim()    || 'Obra';
  const fecha   = document.getElementById('p-fecha').value          || new Date().toISOString().split('T')[0];

  const rows = [
    ['JAVIER MORÁN CONSTRUCCIONES'],
    ['El Calafate, Santa Cruz, Patagonia Argentina'],
    ['Tel: +54 9 2966 54-2820'],
    [''],
    ['PRESUPUESTO'],
    ['Cliente:', cliente],
    ['Obra:', obra],
    ['Dirección:', document.getElementById('p-direccion').value||''],
    ['Fecha:', fecha],
    [''],
    ['Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal'],
    ...items.map(i => [i.desc, parseFloat(i.cant)||0, parseFloat(i.precio)||0, (parseFloat(i.cant)||0)*(parseFloat(i.precio)||0)]),
    [''],
    ['', '', 'SUBTOTAL:', items.reduce((s,i)=>s+(parseFloat(i.cant)||0)*(parseFloat(i.precio)||0),0)],
    ...(ivaOn ? [['','','IVA (21%):', items.reduce((s,i)=>s+(parseFloat(i.cant)||0)*(parseFloat(i.precio)||0),0)*0.21]] : []),
    ['','','TOTAL:', items.reduce((s,i)=>s+(parseFloat(i.cant)||0)*(parseFloat(i.precio)||0),0) * (ivaOn?1.21:1)],
    [''],
    ['Notas:', document.getElementById('p-notas').value||''],
    ['Estado:', document.getElementById('p-estado').value],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:40},{wch:12},{wch:18},{wch:16}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
  XLSX.writeFile(wb, `Presupuesto_${cliente.replace(/\s/g,'_')}_${fecha}.xlsx`);
  toast('Excel generado correctamente');
}

function exportarPresupuestoExcelById(id) {
  const p = presupuestos.find(x => x.id === id);
  if (!p) return;
  const rows = [
    ['JAVIER MORÁN CONSTRUCCIONES'],
    ['El Calafate, Santa Cruz, Patagonia Argentina'],
    ['Tel: +54 9 2966 54-2820'],
    [''],
    ['PRESUPUESTO'],
    ['Cliente:', p.cliente],
    ['Obra:', p.obra],
    ['Dirección:', p.direccion||''],
    ['Fecha:', p.fecha||''],
    [''],
    ['Descripción', 'Cantidad', 'Precio Unitario', 'Subtotal'],
    ...p.items.map(i => [i.desc, parseFloat(i.cant)||0, parseFloat(i.precio)||0, (parseFloat(i.cant)||0)*(parseFloat(i.precio)||0)]),
    [''],
    ['', '', 'SUBTOTAL:', p.sub],
    ...(p.ivaOn ? [['','','IVA (21%):', p.iva]] : []),
    ['','','TOTAL:', p.total],
    [''],
    ['Notas:', p.notas||''],
    ['Estado:', p.estado],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:40},{wch:12},{wch:18},{wch:16}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');
  XLSX.writeFile(wb, `Presupuesto_${p.cliente.replace(/\s/g,'_')}_${p.fecha||'sin-fecha'}.xlsx`);
  toast('Excel generado');
}

function exportarTodosPresupuestosExcel() {
  if (!presupuestos.length) { toast('No hay presupuestos para exportar','err'); return; }
  const rows = [
    ['JAVIER MORÁN CONSTRUCCIONES — HISTORIAL DE PRESUPUESTOS'],
    [''],
    ['#','Cliente','Obra','Fecha','Total','IVA Incluido','Estado'],
    ...presupuestos.map((p,i) => [i+1, p.cliente, p.obra, p.fecha||'', p.total, p.ivaOn?'Sí':'No', p.estado])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:5},{wch:25},{wch:35},{wch:14},{wch:16},{wch:14},{wch:12}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Presupuestos');
  XLSX.writeFile(wb, `JMC_Presupuestos_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('Historial exportado a Excel');
}

// ─── BLOG ───
let pendingBlob = null;

function handleBlogUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const reader = new FileReader();
  reader.onload = e => {
    pendingBlob = e.target.result;
    document.getElementById('blogNewForm').style.display = 'grid';
    document.getElementById('b-titulo').focus();
    document.getElementById('b-anio').value = new Date().getFullYear();
  };
  reader.readAsDataURL(files[0]);
  input.value = '';
}

function confirmarBlogPost() {
  const titulo = document.getElementById('b-titulo').value.trim();
  if (!titulo) { toast('Ingresá un título','err'); return; }
  const post = {
    id:       Date.now(),
    titulo,
    categoria: document.getElementById('b-categoria').value,
    anio:     document.getElementById('b-anio').value || new Date().getFullYear(),
    desc:     document.getElementById('b-descripcion').value,
    img:      pendingBlob,
    fecha:    new Date().toLocaleDateString('es-AR')
  };
  blogPosts.unshift(post);
  localStorage.setItem('jmc_blog', JSON.stringify(blogPosts));
  pendingBlob = null;
  document.getElementById('blogNewForm').style.display = 'none';
  ['b-titulo','b-descripcion'].forEach(id => document.getElementById(id).value = '');
  renderBlog();
  toast('¡Trabajo publicado!');
}

function cancelarBlogPost() {
  pendingBlob = null;
  document.getElementById('blogNewForm').style.display = 'none';
}

function renderBlog() {
  const grid  = document.getElementById('blog-grid');
  const empty = document.getElementById('blog-empty');
  empty.style.display = blogPosts.length ? 'none' : 'block';
  grid.innerHTML = blogPosts.map(p => `
    <div class="blog-post">
      ${p.img
        ? `<img class="blog-post-img" src="${p.img}" alt="${p.titulo}">`
        : `<div class="blog-post-img-placeholder"><i class="fas fa-hard-hat"></i></div>`
      }
      <div class="blog-post-body">
        <div class="tag">${p.categoria}</div>
        <h3>${p.titulo}</h3>
        ${p.desc ? `<p>${p.desc}</p>` : ''}
        <div class="blog-post-meta">
          <span><i class="fas fa-calendar-alt" style="margin-right:4px"></i>${p.anio} · ${p.fecha}</span>
          <button class="btn-delete-post" onclick="eliminarPost(${p.id})" title="Eliminar">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function eliminarPost(id) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  blogPosts = blogPosts.filter(p => p.id !== id);
  localStorage.setItem('jmc_blog', JSON.stringify(blogPosts));
  renderBlog();
  toast('Publicación eliminada');
}

// ─── AGENDA / CLIENTES ───
function guardarCliente() {
  const nombre = document.getElementById('c-nombre').value.trim();
  if (!nombre) { toast('Ingresá el nombre del cliente','err'); return; }

  const cli = {
    id:       editingClientId || Date.now(),
    nombre,
    tel:      document.getElementById('c-tel').value.trim(),
    email:    document.getElementById('c-email').value.trim(),
    direccion: document.getElementById('c-direccion').value.trim(),
    tipoobra: document.getElementById('c-tipoobra').value,
    notas:    document.getElementById('c-notas').value.trim(),
    fecha:    new Date().toLocaleDateString('es-AR')
  };

  if (editingClientId) {
    const idx = clientes.findIndex(c => c.id === editingClientId);
    if (idx >= 0) clientes[idx] = cli;
    editingClientId = null;
    document.getElementById('agendaFormTitle').textContent = 'Nuevo Cliente';
  } else {
    clientes.unshift(cli);
  }

  localStorage.setItem('jmc_clientes', JSON.stringify(clientes));
  limpiarFormCliente();
  renderClientes();
  toast('Cliente guardado correctamente');
}

function limpiarFormCliente() {
  ['c-nombre','c-tel','c-email','c-direccion','c-notas'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('c-tipoobra').value = '';
  editingClientId = null;
  document.getElementById('agendaFormTitle').textContent = 'Nuevo Cliente';
}

function renderClientes() {
  const q     = (document.getElementById('buscarCliente')?.value || '').toLowerCase();
  const list  = document.getElementById('clientes-list');
  const empty = document.getElementById('clientes-empty');
  const count = document.getElementById('clientes-count');

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(q) ||
    (c.tel||'').includes(q) ||
    (c.tipoobra||'').toLowerCase().includes(q)
  );

  count.textContent = filtered.length + ' cliente' + (filtered.length!==1?'s':'') + ' registrado' + (filtered.length!==1?'s':'');
  empty.style.display = filtered.length ? 'none' : 'block';

  list.innerHTML = filtered.map(c => {
    const init = c.nombre.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    return `
      <div class="client-card">
        <div class="client-avatar">${init}</div>
        <div class="client-info">
          <h4>${c.nombre}</h4>
          <span>${c.tel ? `<i class="fas fa-phone"></i> ${c.tel}` : ''}</span>
          ${c.tipoobra ? `<span style="margin-top:2px"><i class="fas fa-hard-hat"></i> ${c.tipoobra}</span>` : ''}
        </div>
        <div class="client-actions">
          <button class="btn-icon edit" title="Editar" onclick="editarCliente(${c.id})"><i class="fas fa-edit"></i></button>
          <button class="btn-icon" title="WhatsApp" style="color:#25d366;border:1px solid rgba(37,211,102,0.2)"
            onclick="window.open('https://wa.me/${'+54'}'+c.tel.replace(/[^0-9]/g,''),'_blank')">
            <i class="fab fa-whatsapp"></i>
          </button>
          <button class="btn-icon delete" title="Eliminar" onclick="eliminarCliente(${c.id})"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function editarCliente(id) {
  const c = clientes.find(x => x.id === id);
  if (!c) return;
  editingClientId = id;
  document.getElementById('c-nombre').value    = c.nombre;
  document.getElementById('c-tel').value       = c.tel||'';
  document.getElementById('c-email').value     = c.email||'';
  document.getElementById('c-direccion').value = c.direccion||'';
  document.getElementById('c-tipoobra').value  = c.tipoobra||'';
  document.getElementById('c-notas').value     = c.notas||'';
  document.getElementById('agendaFormTitle').textContent = 'Editar Cliente';
  window.scrollTo({ top: 72, behavior: 'smooth' });
}

function eliminarCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  clientes = clientes.filter(c => c.id !== id);
  localStorage.setItem('jmc_clientes', JSON.stringify(clientes));
  renderClientes();
  toast('Cliente eliminado');
}

// ─── EXPORT AGENDA EXCEL ───
function exportarAgendaExcel() {
  if (!clientes.length) { toast('No hay clientes para exportar','err'); return; }
  const rows = [
    ['JAVIER MORÁN CONSTRUCCIONES — AGENDA DE CLIENTES'],
    ['Generado el: ' + new Date().toLocaleDateString('es-AR')],
    [''],
    ['#','Nombre','Teléfono','Email','Dirección','Tipo de Obra','Notas','Registrado'],
    ...clientes.map((c,i) => [i+1, c.nombre, c.tel||'', c.email||'', c.direccion||'', c.tipoobra||'', c.notas||'', c.fecha||''])
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:5},{wch:28},{wch:18},{wch:28},{wch:30},{wch:22},{wch:35},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, `JMC_Agenda_Clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
  toast('Agenda exportada a Excel');
}

// ─── PDF HELPERS ───
function pdfHeader(doc) {
  // Dark header bar
  doc.setFillColor(44, 36, 22);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFontSize(18);
  doc.setTextColor(201, 169, 110);
  doc.setFont('helvetica', 'bold');
  doc.text('JAVIER MORAN CONSTRUCCIONES', 14, 12);
  doc.setFontSize(8);
  doc.setTextColor(125, 184, 212);
  doc.setFont('helvetica', 'normal');
  doc.text('El Calafate, Santa Cruz, Patagonia Argentina   |   +54 9 2966 54-2820', 14, 20);
  doc.setTextColor(40, 40, 40);
}

function pdfFooter(doc) {
  const pg = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pg; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text('Javier Moran Construcciones · El Calafate · +54 9 2966 54-2820', 14, 290);
    doc.text('Pagina ' + i + ' de ' + pg, 196, 290, { align: 'right' });
  }
}

// ─── PDF PRESUPUESTO ACTUAL ───
function exportarPresupuestoPDF() {
  const cliente = document.getElementById('p-cliente').value.trim() || 'Cliente';
  const obra    = document.getElementById('p-obra').value.trim()    || 'Obra';
  const fecha   = document.getElementById('p-fecha').value          || new Date().toISOString().split('T')[0];
  const dir     = document.getElementById('p-direccion').value      || '';
  const notas   = document.getElementById('p-notas').value          || '';
  const estado  = document.getElementById('p-estado').value         || 'pendiente';
  const sub     = items.reduce((s,i)=>s+(parseFloat(i.cant)||0)*(parseFloat(i.precio)||0),0);
  const iva     = ivaOn ? sub*0.21 : 0;
  const total   = sub + iva;
  _generarPresupuestoPDF({ cliente, obra, fecha, dir, notas, estado, items: JSON.parse(JSON.stringify(items)), ivaOn, sub, iva, total });
}

function exportarPresupuestoPDFById(id) {
  const p = presupuestos.find(x => x.id === id);
  if (!p) return;
  _generarPresupuestoPDF({ cliente:p.cliente, obra:p.obra, fecha:p.fecha, dir:p.direccion||'', notas:p.notas||'', estado:p.estado, items:p.items, ivaOn:p.ivaOn, sub:p.sub, iva:p.iva, total:p.total });
}

function _generarPresupuestoPDF(p) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc);

  // Info block
  doc.setFontSize(11);
  doc.setTextColor(40,40,40);
  doc.setFont('helvetica','bold');
  doc.text('PRESUPUESTO', 14, 38);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);

  const info = [
    ['Cliente:', p.cliente],
    ['Obra / Trabajo:', p.obra],
    ['Direccion:', p.dir],
    ['Fecha:', p.fecha],
    ['Estado:', p.estado.toUpperCase()],
  ];
  let y = 45;
  info.forEach(([k,v]) => {
    doc.setFont('helvetica','bold'); doc.setTextColor(107,79,42);
    doc.text(k, 14, y);
    doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40);
    doc.text(v||'', 52, y);
    y += 7;
  });

  // Separator
  doc.setDrawColor(201,169,110);
  doc.setLineWidth(0.4);
  doc.line(14, y+2, 196, y+2);
  y += 8;

  // Items table
  doc.autoTable({
    startY: y,
    head: [['Descripcion', 'Cantidad', 'Precio Unit.', 'Subtotal']],
    body: p.items.map(i => [
      i.desc||'',
      (parseFloat(i.cant)||0).toString(),
      '$ ' + (parseFloat(i.precio)||0).toLocaleString('es-AR',{minimumFractionDigits:2}),
      '$ ' + ((parseFloat(i.cant)||0)*(parseFloat(i.precio)||0)).toLocaleString('es-AR',{minimumFractionDigits:2})
    ]),
    headStyles: { fillColor:[44,36,22], textColor:[201,169,110], fontStyle:'bold', fontSize:9 },
    bodyStyles: { fontSize:9, textColor:[40,40,40] },
    alternateRowStyles: { fillColor:[248,244,235] },
    columnStyles: { 0:{cellWidth:85}, 1:{cellWidth:22,halign:'center'}, 2:{cellWidth:40,halign:'right'}, 3:{cellWidth:36,halign:'right'} },
    styles: { cellPadding:3 },
    margin: { left:14, right:14 },
    theme: 'grid',
  });

  let ty = doc.lastAutoTable.finalY + 6;

  // Totals
  const totals = [['SUBTOTAL', '$ ' + p.sub.toLocaleString('es-AR',{minimumFractionDigits:2})]];
  if (p.ivaOn) totals.push(['IVA (21%)', '$ ' + p.iva.toLocaleString('es-AR',{minimumFractionDigits:2})]);
  totals.push(['TOTAL', '$ ' + p.total.toLocaleString('es-AR',{minimumFractionDigits:2})]);

  doc.autoTable({
    startY: ty,
    body: totals,
    bodyStyles: { fontSize:9 },
    columnStyles: { 0:{cellWidth:40,fontStyle:'bold',textColor:[107,79,42],halign:'right'}, 1:{cellWidth:36,halign:'right'} },
    margin: { left:120, right:14 },
    theme: 'plain',
    didDrawRow: (data) => {
      if (data.row.index === totals.length-1) {
        doc.setFillColor(44,36,22);
        doc.rect(data.row.cells[0].x-1, data.row.cells[0].y-1, 79, data.row.height+2, 'F');
        doc.setTextColor(201,169,110);
        doc.setFont('helvetica','bold');
        doc.setFontSize(11);
        doc.text('TOTAL', data.row.cells[0].x+38, data.row.cells[0].y+data.row.height/2+1.5, {align:'right'});
        doc.text('$ ' + p.total.toLocaleString('es-AR',{minimumFractionDigits:2}), data.row.cells[1].x+35, data.row.cells[0].y+data.row.height/2+1.5, {align:'right'});
      }
    }
  });

  // Notas
  if (p.notas) {
    let ny = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(107,79,42);
    doc.text('Notas / Condiciones:', 14, ny);
    doc.setFont('helvetica','normal'); doc.setTextColor(60,60,60);
    const lines = doc.splitTextToSize(p.notas, 180);
    doc.text(lines, 14, ny+6);
  }

  pdfFooter(doc);
  doc.save('Presupuesto_' + p.cliente.replace(/\s/g,'_') + '_' + p.fecha + '.pdf');
  toast('PDF generado correctamente');
}

// ─── PDF TODOS LOS PRESUPUESTOS ───
function exportarTodosPresupuestosPDF() {
  if (!presupuestos.length) { toast('No hay presupuestos para exportar','err'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  pdfHeader(doc);

  doc.setFontSize(13); doc.setFont('helvetica','bold'); doc.setTextColor(44,36,22);
  doc.text('HISTORIAL DE PRESUPUESTOS', 14, 38);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(100);
  doc.text('Generado: ' + new Date().toLocaleDateString('es-AR'), 14, 44);

  doc.autoTable({
    startY: 50,
    head: [['#','Cliente','Obra','Fecha','Total','IVA','Estado']],
    body: presupuestos.map((p,i) => [
      i+1, p.cliente, p.obra, p.fecha||'',
      '$ ' + (p.total||0).toLocaleString('es-AR',{minimumFractionDigits:2}),
      p.ivaOn?'Si':'No', p.estado
    ]),
    headStyles: { fillColor:[44,36,22], textColor:[201,169,110], fontStyle:'bold', fontSize:8 },
    bodyStyles: { fontSize:8, textColor:[40,40,40] },
    alternateRowStyles: { fillColor:[248,244,235] },
    columnStyles: { 0:{cellWidth:8}, 1:{cellWidth:32}, 2:{cellWidth:50}, 3:{cellWidth:22}, 4:{cellWidth:30,halign:'right'}, 5:{cellWidth:12,halign:'center'}, 6:{cellWidth:22,halign:'center'} },
    theme:'grid',
    margin:{left:14,right:14}
  });

  pdfFooter(doc);
  doc.save('JMC_Presupuestos_' + new Date().toISOString().split('T')[0] + '.pdf');
  toast('PDF historial generado');
}

// ─── PDF AGENDA ───
function exportarAgendaPDF() {
  if (!clientes.length) { toast('No hay clientes para exportar','err'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');
  // Header landscape
  doc.setFillColor(44,36,22);
  doc.rect(0,0,297,22,'F');
  doc.setFontSize(16); doc.setTextColor(201,169,110); doc.setFont('helvetica','bold');
  doc.text('JAVIER MORAN CONSTRUCCIONES - AGENDA DE CLIENTES', 14, 10);
  doc.setFontSize(7); doc.setTextColor(125,184,212); doc.setFont('helvetica','normal');
  doc.text('El Calafate, Santa Cruz, Patagonia Argentina   |   +54 9 2966 54-2820   |   Generado: ' + new Date().toLocaleDateString('es-AR'), 14, 17);

  doc.autoTable({
    startY: 28,
    head: [['#','Nombre Completo','Telefono','Email','Direccion','Tipo de Obra','Notas','Registrado']],
    body: clientes.map((c,i) => [i+1, c.nombre, c.tel||'', c.email||'', c.direccion||'', c.tipoobra||'', c.notas||'', c.fecha||'']),
    headStyles: { fillColor:[44,36,22], textColor:[201,169,110], fontStyle:'bold', fontSize:8 },
    bodyStyles: { fontSize:8, textColor:[40,40,40] },
    alternateRowStyles: { fillColor:[248,244,235] },
    columnStyles: { 0:{cellWidth:8}, 1:{cellWidth:38}, 2:{cellWidth:28}, 3:{cellWidth:45}, 4:{cellWidth:38}, 5:{cellWidth:30}, 6:{cellWidth:50}, 7:{cellWidth:20} },
    theme:'grid',
    margin:{left:14,right:14}
  });

  // Footer
  const pg = doc.internal.getNumberOfPages();
  for (let i=1;i<=pg;i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text('Javier Moran Construcciones · El Calafate · +54 9 2966 54-2820', 14, 205);
    doc.text('Pagina '+i+' de '+pg, 283, 205, {align:'right'});
  }

  doc.save('JMC_Agenda_Clientes_' + new Date().toISOString().split('T')[0] + '.pdf');
  toast('PDF agenda generado');
}

// ─── FOTOS DESTACADAS ───
let fotosDestacadas = JSON.parse(localStorage.getItem('jmc_fotos') || '[]');
const MAX_FOTOS = 5;

function handleFotosUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const restantes = MAX_FOTOS - fotosDestacadas.length;
  if (restantes <= 0) { toast('Límite de 5 fotos alcanzado','err'); input.value=''; return; }
  const toLoad = files.slice(0, restantes);
  let loaded = 0;
  toLoad.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      fotosDestacadas.push({ id: Date.now() + Math.random(), src: e.target.result });
      loaded++;
      if (loaded === toLoad.length) {
        guardarFotos();
        renderFotos();
        actualizarBanner();
        toast(loaded + ' foto' + (loaded>1?'s':'') + ' agregada' + (loaded>1?'s':''));
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function guardarFotos() {
  localStorage.setItem('jmc_fotos', JSON.stringify(fotosDestacadas));
}

function eliminarFoto(id) {
  fotosDestacadas = fotosDestacadas.filter(f => f.id !== id);
  guardarFotos();
  renderFotos();
  actualizarBanner();
  toast('Foto eliminada');
}

function renderFotos() {
  const grid    = document.getElementById('fotosGrid');
  const empty   = document.getElementById('fotosEmpty');
  const badge   = document.getElementById('fotosCountBadge');
  const warn    = document.getElementById('fotosMaxWarn');
  const area    = document.getElementById('fotosUploadArea');
  const count   = fotosDestacadas.length;

  badge.innerHTML = `<i class="fas fa-image"></i> ${count} / ${MAX_FOTOS} fotos`;
  warn.classList.toggle('show', count >= MAX_FOTOS);
  area.style.opacity = count >= MAX_FOTOS ? '0.4' : '1';
  area.style.pointerEvents = count >= MAX_FOTOS ? 'none' : 'auto';
  empty.style.display = count ? 'none' : 'block';

  grid.innerHTML = fotosDestacadas.map(f => `
    <div class="foto-thumb">
      <img src="${f.src}" alt="Trabajo destacado">
      <button class="foto-del" onclick="eliminarFoto(${f.id})" title="Eliminar">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

function actualizarBanner() {
  const banner = document.getElementById('bannerDestacados');
  const track  = document.getElementById('bannerTrack');

  if (!fotosDestacadas.length) {
    banner.classList.remove('visible');
    document.body.classList.remove('banner-on');
    return;
  }

  // Duplicar fotos para loop infinito suave
  const imgs = [...fotosDestacadas, ...fotosDestacadas];
  track.innerHTML = imgs.map(f =>
    `<img class="banner-foto" src="${f.src}" alt="Trabajo destacado">`
  ).join('');

  // Ajustar velocidad según cantidad
  const duracion = fotosDestacadas.length * 5;
  track.style.animationDuration = duracion + 's';

  banner.classList.add('visible');
  document.body.classList.add('banner-on');
}

// ─── MODAL ───
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── INIT ───
(function init() {
  const fd = document.getElementById('p-fecha');
  if (fd) fd.value = new Date().toISOString().split('T')[0];
  addItem();
  actualizarBanner(); // mostrar banner si hay fotos guardadas
})();
