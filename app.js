// TCG Vault — conectado a Supabase (sin login, acceso publico segun lo acordado)

const sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

let STATE = {
    socios: [],
    productos: [],
    compras: [],
    ventas: [],
    pagos: [],
    inventario: [],
    resumen: [],
    gradings: [],
    rips: [],
};

const formatCurrency = (val) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val || 0);
const todayStr = () => new Date().toISOString().split('T')[0];

function socioNombre(id) {
    const s = STATE.socios.find(s => s.id === id);
    return s ? s.nombre : '-';
}

// ---------- Carga de datos ----------
async function loadAll() {
    const [socios, productos, compras, ventas, pagos, inventario, resumen, gradings, rips] = await Promise.all([
        sb.from('socios').select('*').order('nombre'),
        sb.from('productos').select('*').order('nombre'),
        sb.from('compras').select('*, compra_socios(socio_id, porcentaje)').order('fecha', { ascending: false }),
        sb.from('ventas').select('*, venta_socios(socio_id, porcentaje)').order('fecha', { ascending: false }),
        sb.from('pagos').select('*').order('fecha', { ascending: false }),
        sb.from('inventario_actual').select('*').order('valor_disponible', { ascending: false }),
        sb.from('resumen_por_socio').select('*').order('socio'),
        sb.from('gradings').select('*').order('fecha_envio', { ascending: false }),
        sb.from('rips').select('*, rip_pulls(*)').order('fecha', { ascending: false }),
    ]);
    for (const r of [socios, productos, compras, ventas, pagos, inventario, resumen, gradings, rips]) {
        if (r.error) console.error(r.error);
    }
    STATE.socios = socios.data || [];
    STATE.productos = productos.data || [];
    STATE.compras = compras.data || [];
    STATE.ventas = ventas.data || [];
    STATE.pagos = pagos.data || [];
    STATE.inventario = inventario.data || [];
    STATE.resumen = resumen.data || [];
    STATE.gradings = gradings.data || [];
    STATE.rips = rips.data || [];
}

function productoNombre(id) {
    const p = STATE.productos.find(p => p.id === id);
    return p ? p.nombre : '-';
}

async function findOrCreateProducto(nombre, categoria) {
    const existing = STATE.productos.find(
        p => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (existing) return existing.id;
    const { data, error } = await sb.from('productos')
        .insert({ nombre: nombre.trim(), categoria })
        .select().single();
    if (error) { alert('Error creando producto: ' + error.message); throw error; }
    STATE.productos.push(data);
    return data.id;
}

// ---------- Navegacion ----------
const NAVS = [
    { btn: 'navResumen', view: 'resumenView' },
    { btn: 'navCompras', view: 'comprasView' },
    { btn: 'navReservas', view: 'reservasView' },
    { btn: 'navVentas', view: 'ventasView' },
    { btn: 'navInventario', view: 'inventarioView' },
    { btn: 'navGraded', view: 'gradedView' },
    { btn: 'navRips', view: 'ripsView' },
    { btn: 'navPagos', view: 'pagosView' },
    { btn: 'navSocios', view: 'sociosView' },
];

function switchTab(activeId) {
    NAVS.forEach(n => {
        document.getElementById(n.btn)?.classList.remove('active');
        const view = document.getElementById(n.view);
        if (view) view.style.display = 'none';
    });
    const active = NAVS.find(n => n.btn === activeId);
    if (active) {
        document.getElementById(active.btn)?.classList.add('active');
        const view = document.getElementById(active.view);
        if (view) view.style.display = view.classList.contains('dashboard-grid') ? 'grid' : 'block';
    }
}

// ---------- Reparto de socios (UI reutilizable) ----------
function socioOptionsHtml(selected) {
    return STATE.socios.map(s =>
        `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.nombre}</option>`
    ).join('');
}

function addSocioRow(containerId, socioId, porcentaje) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'form-row socio-row';
    row.innerHTML = `
        <div class="form-group">
            <select class="socio-select">${socioOptionsHtml(socioId)}</select>
        </div>
        <div class="form-group">
            <input type="number" class="socio-pct" min="0.01" max="100" step="0.01" value="${porcentaje}">
        </div>
        <button type="button" class="icon-btn remove-socio-row" title="Quitar">
            <span class="material-symbols-outlined">remove_circle</span>
        </button>
    `;
    row.querySelector('.remove-socio-row').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function resetSocioRows(containerId) {
    document.getElementById(containerId).innerHTML = '';
    addSocioRow(containerId, STATE.socios[0]?.id, 100);
}

function getSocioRows(containerId) {
    const rows = document.querySelectorAll(`#${containerId} .socio-row`);
    return Array.from(rows).map(r => ({
        socio_id: parseInt(r.querySelector('.socio-select').value, 10),
        porcentaje: parseFloat(r.querySelector('.socio-pct').value),
    }));
}

function validateSocioRows(rows) {
    const total = rows.reduce((sum, r) => sum + (r.porcentaje || 0), 0);
    return Math.abs(total - 100) < 0.01;
}

// ---------- Modales ----------
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) e.target.style.display = 'none';
});

function refreshProductosDatalist() {
    const dl = document.getElementById('productosList');
    dl.innerHTML = STATE.productos.map(p => `<option value="${p.nombre}">`).join('');
}

function onProductoInputChange(inputId, categoriaSelectId) {
    const input = document.getElementById(inputId);
    const categoriaSelect = document.getElementById(categoriaSelectId);
    input.addEventListener('input', () => {
        const match = STATE.productos.find(
            p => p.nombre.trim().toLowerCase() === input.value.trim().toLowerCase());
        if (match) {
            categoriaSelect.value = match.categoria;
            categoriaSelect.disabled = true;
        } else {
            categoriaSelect.disabled = false;
        }
    });
}
onProductoInputChange('compraProductoInput', 'compraCategoriaInput');

// ---------- Compras ----------
document.getElementById('addCompraBtn').addEventListener('click', () => {
    document.getElementById('compraForm').reset();
    document.getElementById('compraModalTitle').textContent = 'Nueva compra';
    document.getElementById('compraEstadoInput').value = 'recibido';
    document.getElementById('compraPagadoRow').style.display = 'none';
    document.getElementById('compraCategoriaInput').disabled = false;
    document.getElementById('compraFechaInput').value = todayStr();
    resetSocioRows('compraSociosRows');
    openModal('compraModal');
});

document.getElementById('addReservaBtn').addEventListener('click', () => {
    document.getElementById('compraForm').reset();
    document.getElementById('compraModalTitle').textContent = 'Nueva reserva / pedido';
    document.getElementById('compraEstadoInput').value = 'reservado';
    document.getElementById('compraPagadoRow').style.display = 'flex';
    document.getElementById('compraCategoriaInput').disabled = false;
    document.getElementById('compraFechaInput').value = todayStr();
    resetSocioRows('compraSociosRows');
    openModal('compraModal');
});

document.getElementById('compraAddSocioBtn').addEventListener('click', () => {
    const used = getSocioRows('compraSociosRows').map(r => r.socio_id);
    const next = STATE.socios.find(s => !used.includes(s.id)) || STATE.socios[0];
    addSocioRow('compraSociosRows', next?.id, 0);
});

document.getElementById('compraForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = getSocioRows('compraSociosRows');
    if (!validateSocioRows(rows)) {
        alert('El reparto de socios debe sumar 100%.');
        return;
    }
    const nombre = document.getElementById('compraProductoInput').value;
    const categoria = document.getElementById('compraCategoriaInput').value;
    const producto_id = await findOrCreateProducto(nombre, categoria);

    const estado = document.getElementById('compraEstadoInput').value;
    const vals = {
        producto_id,
        cantidad: parseFloat(document.getElementById('compraCantidadInput').value),
        precio_unitario: parseFloat(document.getElementById('compraPrecioInput').value),
        tipo: document.getElementById('compraTipoInput').value,
        idioma: document.getElementById('compraIdiomaInput').value || null,
        proveedor: document.getElementById('compraProveedorInput').value || null,
        fecha: document.getElementById('compraFechaInput').value,
        estado,
        importe_pagado: estado === 'reservado'
            ? parseFloat(document.getElementById('compraPagadoInput').value || 0)
            : parseFloat(document.getElementById('compraCantidadInput').value) *
              parseFloat(document.getElementById('compraPrecioInput').value),
        comentarios: document.getElementById('compraComentariosInput').value || null,
    };
    const { data: compra, error } = await sb.from('compras').insert(vals).select().single();
    if (error) { alert('Error guardando compra: ' + error.message); return; }

    const socioPayload = rows.map(r => ({ ...r, compra_id: compra.id }));
    const { error: err2 } = await sb.from('compra_socios').insert(socioPayload);
    if (err2) { alert('Error guardando reparto: ' + err2.message); return; }

    closeModal('compraModal');
    await loadAll();
    renderAll();
});

function renderCompras() {
    const tbody = document.getElementById('comprasTableBody');
    tbody.innerHTML = '';
    STATE.compras.filter(c => c.estado === 'recibido').forEach(c => {
        const socios = (c.compra_socios || [])
            .map(s => `${socioNombre(s.socio_id)} (${s.porcentaje}%)`).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.referencia}</td>
            <td>${c.fecha || '-'}</td>
            <td>${productoNombre(c.producto_id)}</td>
            <td>${STATE.productos.find(p => p.id === c.producto_id)?.categoria || '-'}</td>
            <td class="text-right">${c.cantidad}</td>
            <td class="text-right">${formatCurrency(c.precio_unitario)}</td>
            <td class="text-right">${formatCurrency(c.precio_total)}</td>
            <td>${socios}</td>
            <td><span class="pl-badge positive">Recibido</span></td>
            <td><button class="icon-btn delete-compra" data-id="${c.id}" title="Eliminar"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button></td>
        `;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.delete-compra').forEach(btn => {
        btn.addEventListener('click', () => deleteCompra(btn.dataset.id));
    });
}

function renderReservas() {
    const tbody = document.getElementById('reservasTableBody');
    tbody.innerHTML = '';
    STATE.compras.filter(c => c.estado === 'reservado').forEach(c => {
        const socios = (c.compra_socios || [])
            .map(s => `${socioNombre(s.socio_id)} (${s.porcentaje}%)`).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.referencia}</td>
            <td>${c.fecha || '-'}</td>
            <td>${productoNombre(c.producto_id)}</td>
            <td>${c.proveedor || '-'}</td>
            <td class="text-right">${formatCurrency(c.precio_total)}</td>
            <td class="text-right">${formatCurrency(c.importe_pagado)}</td>
            <td class="text-right">${formatCurrency(c.pendiente_pagar)}</td>
            <td>${socios}</td>
            <td>
                <button class="icon-btn receive-compra" data-id="${c.id}" title="Marcar recibido"><span class="material-symbols-outlined" style="font-size:16px;">inventory_2</span></button>
                <button class="icon-btn delete-compra" data-id="${c.id}" title="Eliminar"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.delete-compra').forEach(btn => {
        btn.addEventListener('click', () => deleteCompra(btn.dataset.id));
    });
    tbody.querySelectorAll('.receive-compra').forEach(btn => {
        btn.addEventListener('click', () => marcarRecibido(btn.dataset.id));
    });
}

async function marcarRecibido(id) {
    const compra = STATE.compras.find(c => String(c.id) === String(id));
    if (!compra) return;
    const { error } = await sb.from('compras').update({
        estado: 'recibido',
        importe_pagado: compra.precio_total,
    }).eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    await loadAll();
    renderAll();
}

async function deleteCompra(id) {
    if (!confirm('¿Eliminar esta compra?')) return;
    const { error } = await sb.from('compras').delete().eq('id', id);
    if (error) { alert('Error: ' + error.message); return; }
    await loadAll();
    renderAll();
}

// ---------- Ventas ----------
onProductoInputChange('ventaProductoInput', null);

document.getElementById('addVentaBtn').addEventListener('click', () => {
    document.getElementById('ventaForm').reset();
    document.getElementById('ventaFechaInput').value = todayStr();
    resetSocioRows('ventaSociosRows');
    openModal('ventaModal');
});

document.getElementById('ventaAddSocioBtn').addEventListener('click', () => {
    const used = getSocioRows('ventaSociosRows').map(r => r.socio_id);
    const next = STATE.socios.find(s => !used.includes(s.id)) || STATE.socios[0];
    addSocioRow('ventaSociosRows', next?.id, 0);
});

document.getElementById('ventaForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const rows = getSocioRows('ventaSociosRows');
    if (!validateSocioRows(rows)) {
        alert('El reparto de socios debe sumar 100%.');
        return;
    }
    const nombre = document.getElementById('ventaProductoInput').value;
    const existing = STATE.productos.find(
        p => p.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
    if (!existing) {
        alert('Ese producto no existe todavía. Añádelo primero con una compra.');
        return;
    }
    const vals = {
        producto_id: existing.id,
        cantidad: parseFloat(document.getElementById('ventaCantidadInput').value),
        precio_compra_base: parseFloat(document.getElementById('ventaCosteInput').value),
        precio_venta: parseFloat(document.getElementById('ventaPrecioInput').value),
        canal: document.getElementById('ventaCanalInput').value,
        fecha: document.getElementById('ventaFechaInput').value,
        cobrado: document.getElementById('ventaCobradoInput').value === 'true',
        comentarios: document.getElementById('ventaComentariosInput').value || null,
    };
    const { data: venta, error } = await sb.from('ventas').insert(vals).select().single();
    if (error) { alert('Error guardando venta: ' + error.message); return; }

    const socioPayload = rows.map(r => ({ ...r, venta_id: venta.id }));
    const { error: err2 } = await sb.from('venta_socios').insert(socioPayload);
    if (err2) { alert('Error guardando reparto: ' + err2.message); return; }

    closeModal('ventaModal');
    await loadAll();
    renderAll();
});

function renderVentas() {
    const tbody = document.getElementById('ventasTableBody');
    tbody.innerHTML = '';
    STATE.ventas.forEach(v => {
        const socios = (v.venta_socios || [])
            .map(s => `${socioNombre(s.socio_id)} (${s.porcentaje}%)`).join(', ');
        const costeTotal = (v.precio_compra_base || 0) * (v.cantidad || 0);
        const margen = costeTotal > 0
            ? ((v.precio_total_venta - costeTotal) / costeTotal) * 100
            : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${v.referencia}</td>
            <td>${v.fecha || '-'}</td>
            <td>${productoNombre(v.producto_id)}</td>
            <td class="text-right">${v.cantidad}</td>
            <td class="text-right">${formatCurrency(v.precio_venta)}</td>
            <td class="text-right">${formatCurrency(v.precio_total_venta)}</td>
            <td class="text-right"><span class="pl-badge ${margen >= 0 ? 'positive' : 'negative'}">${margen.toFixed(1)}%</span></td>
            <td>${v.canal}</td>
            <td>${v.cobrado ? '<span class="pl-badge positive">Sí</span>' : '<span class="pl-badge negative">Pendiente</span>'}</td>
            <td>${socios}</td>
            <td><button class="icon-btn delete-venta" data-id="${v.id}" title="Eliminar"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button></td>
        `;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.delete-venta').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta venta?')) return;
            const { error } = await sb.from('ventas').delete().eq('id', btn.dataset.id);
            if (error) { alert('Error: ' + error.message); return; }
            await loadAll();
            renderAll();
        });
    });
}

// ---------- Inventario ----------
function renderInventario() {
    const tbody = document.getElementById('inventarioTableBody');
    tbody.innerHTML = '';
    STATE.inventario.filter(i => i.cantidad_disponible > 0).forEach(i => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${i.producto}</td>
            <td>${i.categoria}</td>
            <td class="text-right">${i.cantidad_comprada}</td>
            <td class="text-right">${i.cantidad_vendida}</td>
            <td class="text-right">${i.cantidad_disponible}</td>
            <td class="text-right">${formatCurrency(i.coste_medio)}</td>
            <td class="text-right">${formatCurrency(i.valor_disponible)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------- Pagos ----------
function fillPagadorSelect() {
    document.getElementById('pagoPagadorInput').innerHTML = socioOptionsHtml(null);
}

document.getElementById('addPagoBtn').addEventListener('click', () => {
    document.getElementById('pagoForm').reset();
    document.getElementById('pagoFechaInput').value = todayStr();
    fillPagadorSelect();
    openModal('pagoModal');
});

document.getElementById('pagoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vals = {
        pagador_id: parseInt(document.getElementById('pagoPagadorInput').value, 10),
        importe: parseFloat(document.getElementById('pagoImporteInput').value),
        fecha: document.getElementById('pagoFechaInput').value,
        descripcion: document.getElementById('pagoDescripcionInput').value || null,
    };
    const { error } = await sb.from('pagos').insert(vals);
    if (error) { alert('Error guardando pago: ' + error.message); return; }
    closeModal('pagoModal');
    await loadAll();
    renderAll();
});

function renderPagos() {
    const tbody = document.getElementById('pagosTableBody');
    tbody.innerHTML = '';
    STATE.pagos.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.referencia}</td>
            <td>${p.fecha || '-'}</td>
            <td>${socioNombre(p.pagador_id)}</td>
            <td class="text-right">${formatCurrency(p.importe)}</td>
            <td>${p.descripcion || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------- Resumen por socio ----------
function renderSocios() {
    const tbody = document.getElementById('sociosTableBody');
    tbody.innerHTML = '';
    STATE.resumen.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.socio}</td>
            <td class="text-right">${formatCurrency(r.invertido)}</td>
            <td class="text-right">${formatCurrency(r.pendiente_pago_compra)}</td>
            <td class="text-right">${formatCurrency(r.vendido)}</td>
            <td class="text-right">${formatCurrency(r.cobrado)}</td>
            <td class="text-right"><span class="pl-badge ${r.beneficio >= 0 ? 'positive' : 'negative'}">${formatCurrency(r.beneficio)}</span></td>
            <td class="text-right">${formatCurrency(r.pagos_realizados)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------- Resumen / graficos ----------
let categoriaChart = null;
let socioChart = null;

function renderResumen() {
    const totalComprado = STATE.inventario.reduce((s, i) => s + (i.cantidad_comprada > 0 ? i.cantidad_comprada * i.coste_medio : 0), 0);
    const totalVendido = STATE.resumen.reduce((s, r) => s + (r.vendido || 0), 0);
    const totalInvertido = STATE.resumen.reduce((s, r) => s + (r.invertido || 0), 0);
    const beneficio = totalVendido - totalInvertido;
    const valorInventario = STATE.inventario.reduce((s, i) => s + (i.valor_disponible || 0), 0);
    const pendientePago = STATE.resumen.reduce((s, r) => s + (r.pendiente_pago_compra || 0), 0);

    document.getElementById('statValorInventario').textContent = formatCurrency(valorInventario);
    document.getElementById('statTotalComprado').textContent = formatCurrency(totalInvertido);
    document.getElementById('statTotalVendido').textContent = formatCurrency(totalVendido);
    document.getElementById('statBeneficio').textContent = formatCurrency(beneficio);
    document.getElementById('statPendientePago').textContent = formatCurrency(pendientePago);

    // Grafico por categoria
    const byCat = {};
    STATE.inventario.forEach(i => {
        if (!byCat[i.categoria]) byCat[i.categoria] = 0;
        byCat[i.categoria] += i.valor_disponible || 0;
    });
    const catLabels = Object.keys(byCat).filter(k => byCat[k] > 0);
    const catValues = catLabels.map(k => byCat[k]);

    const ctx1 = document.getElementById('categoriaChart');
    if (categoriaChart) categoriaChart.destroy();
    if (ctx1 && window.Chart) {
        categoriaChart = new Chart(ctx1.getContext('2d'), {
            type: 'doughnut',
            data: { labels: catLabels, datasets: [{ data: catValues }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });
    }

    // Grafico por socio
    const socioLabels = STATE.resumen.map(r => r.socio);
    const invertidoData = STATE.resumen.map(r => r.invertido);
    const vendidoData = STATE.resumen.map(r => r.vendido);

    const ctx2 = document.getElementById('socioChart');
    if (socioChart) socioChart.destroy();
    if (ctx2 && window.Chart) {
        socioChart = new Chart(ctx2.getContext('2d'), {
            type: 'bar',
            data: {
                labels: socioLabels,
                datasets: [
                    { label: 'Invertido', data: invertidoData },
                    { label: 'Vendido', data: vendidoData },
                ],
            },
            options: { responsive: true, maintainAspectRatio: false },
        });
    }
}

// ---------- Envios a gradear ----------
function compraLabel(c) {
    return `${productoNombre(c.producto_id)} — ${c.fecha || 's/f'} — ${formatCurrency(c.precio_unitario)}`;
}

function fillCompraOrigenSelect(selectId, tipo) {
    const sel = document.getElementById(selectId);
    const candidatas = STATE.compras.filter(c => c.estado === 'recibido' && c.tipo === tipo);
    sel.innerHTML = candidatas.map(c => `<option value="${c.id}">${compraLabel(c)}</option>`).join('');
}

async function copiarRepartoSocios(origenCompraId, nuevaCompraId) {
    const origen = STATE.compras.find(c => c.id === origenCompraId);
    const rows = (origen?.compra_socios || []).map(s => ({
        compra_id: nuevaCompraId, socio_id: s.socio_id, porcentaje: s.porcentaje,
    }));
    if (rows.length) await sb.from('compra_socios').insert(rows);
}

document.getElementById('addGradingBtn').addEventListener('click', () => {
    document.getElementById('gradingForm').reset();
    document.getElementById('gradingFechaInput').value = todayStr();
    fillCompraOrigenSelect('gradingCompraOrigenInput', 'RAW');
    openModal('gradingModal');
});

document.getElementById('gradingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vals = {
        compra_origen_id: parseInt(document.getElementById('gradingCompraOrigenInput').value, 10),
        grading_company: document.getElementById('gradingEmpresaInput').value,
        coste_grading: parseFloat(document.getElementById('gradingCosteInput').value),
        fecha_envio: document.getElementById('gradingFechaInput').value,
        estado: 'enviado',
        comentarios: document.getElementById('gradingComentariosInput').value || null,
    };
    const { error } = await sb.from('gradings').insert(vals);
    if (error) { alert('Error: ' + error.message); return; }
    closeModal('gradingModal');
    await loadAll();
    renderAll();
});

function renderGraded() {
    const tbody = document.getElementById('gradedTableBody');
    tbody.innerHTML = '';
    STATE.gradings.forEach(g => {
        const origen = STATE.compras.find(c => c.id === g.compra_origen_id);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${g.referencia}</td>
            <td>${origen ? productoNombre(origen.producto_id) : '-'}</td>
            <td>${g.grading_company}</td>
            <td class="text-right">${formatCurrency(g.coste_grading)}</td>
            <td>${g.fecha_envio || '-'}</td>
            <td>${g.estado === 'recibido'
                ? '<span class="pl-badge positive">Recibido</span>'
                : '<span class="pl-badge negative">Enviado</span>'}</td>
            <td class="text-right">${g.grado ?? '-'}</td>
            <td>${g.fecha_recibido || '-'}</td>
            <td>
                ${g.estado === 'enviado'
                    ? `<button class="icon-btn mark-grading-recibido" data-id="${g.id}" title="Marcar recibido"><span class="material-symbols-outlined" style="font-size:16px;">inventory_2</span></button>`
                    : ''}
                <button class="icon-btn delete-grading" data-id="${g.id}" title="Eliminar"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.mark-grading-recibido').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('gradingRecibidoForm').reset();
            document.getElementById('gradingRecibidoIdInput').value = btn.dataset.id;
            document.getElementById('gradingFechaRecibidoInput').value = todayStr();
            openModal('gradingRecibidoModal');
        });
    });
    tbody.querySelectorAll('.delete-grading').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar este envío a gradear?')) return;
            const { error } = await sb.from('gradings').delete().eq('id', btn.dataset.id);
            if (error) { alert('Error: ' + error.message); return; }
            await loadAll();
            renderAll();
        });
    });
}

document.getElementById('gradingRecibidoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const gradingId = parseInt(document.getElementById('gradingRecibidoIdInput').value, 10);
    const grading = STATE.gradings.find(g => g.id === gradingId);
    const origen = STATE.compras.find(c => c.id === grading.compra_origen_id);
    if (!grading || !origen) return;

    const grado = parseFloat(document.getElementById('gradingGradoInput').value);
    const fechaRecibido = document.getElementById('gradingFechaRecibidoInput').value;

    // 1. Resta 1 unidad de la compra RAW original (ese ejemplar pasa a ser la carta gradeada)
    const { error: errUpd } = await sb.from('compras')
        .update({ cantidad: origen.cantidad - 1 })
        .eq('id', origen.id);
    if (errUpd) { alert('Error actualizando origen: ' + errUpd.message); return; }

    // 2. Crea la nueva compra GRADED con el coste total (original + grading)
    const { data: nueva, error: errIns } = await sb.from('compras').insert({
        producto_id: origen.producto_id,
        cantidad: 1,
        precio_unitario: origen.precio_unitario + grading.coste_grading,
        tipo: 'GRADED',
        grading_company: grading.grading_company,
        grade: grado,
        idioma: origen.idioma,
        fecha: fechaRecibido,
        estado: 'recibido',
        comentarios: `Gradeada a partir de ${origen.referencia}`,
    }).select().single();
    if (errIns) { alert('Error creando compra gradeada: ' + errIns.message); return; }

    await copiarRepartoSocios(origen.id, nueva.id);

    // 3. Cierra el envio
    const { error: errG } = await sb.from('gradings').update({
        estado: 'recibido', grado, fecha_recibido: fechaRecibido, compra_resultante_id: nueva.id,
    }).eq('id', gradingId);
    if (errG) { alert('Error: ' + errG.message); return; }

    closeModal('gradingRecibidoModal');
    await loadAll();
    renderAll();
});

// ---------- Rips ----------
let ripPullsCounter = 0;

function addPullRow(producto = '', categoria = 'Pokémon', cantidad = 1) {
    const container = document.getElementById('ripPullsRows');
    const row = document.createElement('div');
    row.className = 'form-row socio-row';
    const uid = ripPullsCounter++;
    row.innerHTML = `
        <div class="form-group">
            <input type="text" class="pull-producto" list="productosList" placeholder="Nombre de la carta" value="${producto}" autocomplete="off">
        </div>
        <div class="form-group">
            <select class="pull-categoria">
                <option value="Pokémon">Pokémon</option>
                <option value="One Piece">One Piece</option>
                <option value="Disney Lorcana">Disney Lorcana</option>
                <option value="Riftbound">Riftbound</option>
                <option value="Magic: The Gathering">Magic: The Gathering</option>
                <option value="Yu-Gi-Oh!">Yu-Gi-Oh!</option>
                <option value="Naruto">Naruto</option>
                <option value="Otros TCG">Otros TCG</option>
            </select>
        </div>
        <div class="form-group" style="flex:0 0 80px;">
            <input type="number" class="pull-cantidad" min="1" step="1" value="${cantidad}">
        </div>
        <button type="button" class="icon-btn remove-socio-row" title="Quitar">
            <span class="material-symbols-outlined">remove_circle</span>
        </button>
    `;
    row.querySelector('.pull-categoria').value = categoria;
    const productoInput = row.querySelector('.pull-producto');
    const categoriaSelect = row.querySelector('.pull-categoria');
    productoInput.addEventListener('input', () => {
        const match = STATE.productos.find(
            p => p.nombre.trim().toLowerCase() === productoInput.value.trim().toLowerCase());
        if (match) {
            categoriaSelect.value = match.categoria;
            categoriaSelect.disabled = true;
        } else {
            categoriaSelect.disabled = false;
        }
    });
    row.querySelector('.remove-socio-row').addEventListener('click', () => row.remove());
    container.appendChild(row);
}

function getPullRows() {
    return Array.from(document.querySelectorAll('#ripPullsRows .socio-row')).map(r => ({
        nombre: r.querySelector('.pull-producto').value.trim(),
        categoria: r.querySelector('.pull-categoria').value,
        cantidad: parseFloat(r.querySelector('.pull-cantidad').value) || 1,
    })).filter(p => p.nombre);
}

document.getElementById('addRipBtn').addEventListener('click', () => {
    document.getElementById('ripForm').reset();
    document.getElementById('ripFechaInput').value = todayStr();
    fillCompraOrigenSelect('ripCompraOrigenInput', 'SEALED');
    document.getElementById('ripPullsRows').innerHTML = '';
    addPullRow();
    openModal('ripModal');
});

document.getElementById('ripAddPullBtn').addEventListener('click', () => addPullRow());

document.getElementById('ripForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pulls = getPullRows();
    if (!pulls.length) { alert('Añade al menos una carta obtenida.'); return; }

    const origenId = parseInt(document.getElementById('ripCompraOrigenInput').value, 10);
    const vals = {
        compra_origen_id: origenId,
        fecha: document.getElementById('ripFechaInput').value,
        comentarios: document.getElementById('ripComentariosInput').value || null,
    };
    const { data: rip, error } = await sb.from('rips').insert(vals).select().single();
    if (error) { alert('Error guardando rip: ' + error.message); return; }

    for (const pull of pulls) {
        const producto_id = await findOrCreateProducto(pull.nombre, pull.categoria);
        const { data: nuevaCompra, error: errC } = await sb.from('compras').insert({
            producto_id,
            cantidad: pull.cantidad,
            precio_unitario: 0,
            tipo: 'RAW',
            estado: 'recibido',
            fecha: vals.fecha,
            comentarios: `Obtenida al abrir ${STATE.compras.find(c => c.id === origenId)?.referencia || ''}`,
        }).select().single();
        if (errC) { alert('Error creando carta: ' + errC.message); continue; }
        await copiarRepartoSocios(origenId, nuevaCompra.id);
        await sb.from('rip_pulls').insert({
            rip_id: rip.id, producto_id, cantidad: pull.cantidad, compra_resultante_id: nuevaCompra.id,
        });
    }

    closeModal('ripModal');
    await loadAll();
    renderAll();
});

function renderRips() {
    const tbody = document.getElementById('ripsTableBody');
    tbody.innerHTML = '';
    STATE.rips.forEach(r => {
        const origen = STATE.compras.find(c => c.id === r.compra_origen_id);
        const pulls = (r.rip_pulls || [])
            .map(p => `${productoNombre(p.producto_id)} (${p.cantidad}x)`).join(', ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.referencia}</td>
            <td>${r.fecha || '-'}</td>
            <td>${origen ? productoNombre(origen.producto_id) : '-'}</td>
            <td>${pulls || '-'}</td>
            <td><button class="icon-btn delete-rip" data-id="${r.id}" title="Eliminar"><span class="material-symbols-outlined" style="font-size:16px;">delete</span></button></td>
        `;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.delete-rip').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar este rip? (las cartas obtenidas no se borran del inventario)')) return;
            const { error } = await sb.from('rips').delete().eq('id', btn.dataset.id);
            if (error) { alert('Error: ' + error.message); return; }
            await loadAll();
            renderAll();
        });
    });
}

// ---------- Render global ----------
function renderAll() {
    refreshProductosDatalist();
    renderCompras();
    renderReservas();
    renderVentas();
    renderInventario();
    renderPagos();
    renderSocios();
    renderResumen();
    renderGraded();
    renderRips();
}

// ---------- Tema ----------
document.getElementById('themeToggle').addEventListener('click', () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
});

// ---------- Visibilidad de importes ----------
let valuesVisible = true;
document.getElementById('visibilityToggle').addEventListener('click', () => {
    valuesVisible = !valuesVisible;
    document.querySelectorAll('td.text-right, .value, h1').forEach(el => {
        if (!el.dataset.original) el.dataset.original = el.textContent;
        if (/[€%]/.test(el.dataset.original)) {
            el.textContent = valuesVisible ? el.dataset.original : '•••';
        }
    });
});

// ---------- Navegacion click ----------
NAVS.forEach(n => {
    document.getElementById(n.btn)?.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab(n.btn);
    });
});

// ---------- Inicio ----------
(async function init() {
    await loadAll();
    renderAll();
})();
