/* ========= 資料模型 =========
LocalStorage schema:
{
  accounts: { "01": [{name:"色純雪納", note:""}, {name:"嘴玫瑰比熊7", note:""}], "02": [...] },
  selected: "01"
}
*/
const LS_KEY = "sunny-dogs-db-v1";
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

let db = loadDB();
renderAccounts();
renderDogs();

/* 綁定事件 */
$("#btnAddAcc").addEventListener("click", addAccount);
$("#newAccId").addEventListener("keydown", e => { if(e.key==="Enter") addAccount(); });
$("#accSearch").addEventListener("input", renderAccounts);
$("#btnDeleteAcc").addEventListener("click", deleteCurrentAccount);

$("#btnAddDog").addEventListener("click", addDog);
$("#dogName").addEventListener("keydown", e => { if(e.key==="Enter") addDog(); });
$("#dogSearch").addEventListener("input", renderDogs);

$("#btnExport").addEventListener("click", exportJSON);
$("#importFile").addEventListener("change", importJSON);

/* ========== LocalStorage ========== */
function loadDB(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw){
    return { accounts: {}, selected: null };
  }
  try{
    const parsed = JSON.parse(raw);
    if(!parsed.accounts) parsed.accounts = {};
    return parsed;
  }catch(e){
    console.warn("DB parse error, reset.", e);
    return { accounts: {}, selected: null };
  }
}
function saveDB(){ localStorage.setItem(LS_KEY, JSON.stringify(db)); }

/* ========== 帳號 ========== */
function normalizeAccId(id){
  // 僅取數字；1 位自動補 0；允許 2~4 位
  const m = (id||"").replace(/\D/g,"");
  if(!m) return "";
  if(m.length === 1) return "0"+m;
  if(m.length === 2) return m;
  return m.slice(0,4);
}

function addAccount(){
  const raw = $("#newAccId").value.trim();
  const id = normalizeAccId(raw);
  if(!id){ alert("請輸入帳號（數字），例如 01"); return; }
  if(db.accounts[id]){ alert(`帳號 ${id} 已存在`); return; }
  db.accounts[id] = [];
  db.selected = id;
  saveDB();
  $("#newAccId").value="";
  renderAccounts();
  renderDogs();
}

function renderAccounts(){
  const q = $("#accSearch").value.trim();
  const list = Object.keys(db.accounts).sort((a,b)=>a.localeCompare(b, 'zh-Hant', {numeric:true}));
  const mount = $("#accList");
  mount.innerHTML = "";
  const toShow = q ? list.filter(id => id.includes(q)) : list;
  if(toShow.length === 0){
    mount.innerHTML = `<div class="muted">尚無帳號，請先新增。</div>`;
  }else{
    toShow.forEach(id=>{
      const el = document.createElement("div");
      el.className = "acc-item"+(db.selected===id?" active":"");
      el.innerHTML = `
        <div>
          <span class="acc-id">#${id}</span>
          <span class="muted">共 ${db.accounts[id].length} 隻</span>
        </div>
        <div class="muted">切換</div>
      `;
      el.addEventListener("click", ()=>{
        db.selected = id; saveDB(); renderAccounts(); renderDogs();
      });
      mount.appendChild(el);
    });
  }
  $("#btnDeleteAcc").disabled = !db.selected;
}

function deleteCurrentAccount(){
  if(!db.selected) return;
  const id = db.selected;
  if(!confirm(`確定要刪除帳號 #${id} 及其所有狗狗資料嗎？`)) return;
  delete db.accounts[id];
  const rest = Object.keys(db.accounts).sort();
  db.selected = rest[0] || null;
  saveDB();
  renderAccounts();
  renderDogs();
}

/* ========== 狗狗 ========== */
function addDog(){
  const acc = db.selected;
  if(!acc){ alert("請先選取帳號或新增帳號。"); return; }
  const name = $("#dogName").value.trim();
  const note = $("#dogNote").value.trim();
  if(!name){ alert("請輸入狗狗資訊（例如：灰嘴哈15*）"); return; }
  db.accounts[acc].push({ name, note });
  $("#dogName").value=""; $("#dogNote").value="";
  saveDB(); renderAccounts(); renderDogs();
}

function renderDogs(){
  const tbody = $("#dogsTbody");
  tbody.innerHTML = "";
  const acc = db.selected;
  if(!acc){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">尚未選取帳號</td></tr>`;
    $("#btnDeleteAcc").disabled = true;
    return;
  }
  $("#btnDeleteAcc").disabled = false;

  const q = $("#dogSearch").value.trim();
  const dogs = db.accounts[acc];
  const filtered = q ? dogs.map((d,i)=>({...d, _idx:i})).filter(d=>d.name.includes(q) || (d.note&&d.note.includes(q))) 
                     : dogs.map((d,i)=>({...d, _idx:i}));

  if(filtered.length===0){
    tbody.innerHTML = `<tr><td colspan="4" class="muted">此帳號尚無狗狗，或無符合搜尋。</td></tr>`;
    return;
  }

  filtered.forEach(d=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>#${acc}</td>
      <td>
        <div contenteditable="true" data-edit="name" data-idx="${d._idx}" class="editable">${escapeHTML(d.name)}</div>
      </td>
      <td>
        <div contenteditable="true" data-edit="note" data-idx="${d._idx}" class="editable">${escapeHTML(d.note||"")}</div>
      </td>
      <td class="actions">
        <button data-act="up" data-idx="${d._idx}">上移</button>
        <button data-act="down" data-idx="${d._idx}">下移</button>
        <button class="danger" data-act="del" data-idx="${d._idx}">刪除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 綁定（委派）— 內聯編輯 & 操作
  tbody.oninput = handleInlineEdit;
  tbody.onclick = handleRowAction;
}

function handleInlineEdit(e){
  const el = e.target.closest("[data-edit]");
  if(!el) return;
  const idx = Number(el.dataset.idx);
  const field = el.dataset.edit;
  const acc = db.selected;
  if(!db.accounts[acc][idx]) return;
  db.accounts[acc][idx][field] = el.innerText.trim();
  saveDB();
}

function handleRowAction(e){
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const act = btn.dataset.act;
  const idx = Number(btn.dataset.idx);
  const acc = db.selected;
  if(!(acc in db.accounts)) return;

  if(act==="del"){
    if(confirm("確定刪除此狗狗資料？")){
      db.accounts[acc].splice(idx,1);
    }
  }else if(act==="up"){
    if(idx>0){
      const arr = db.accounts[acc];
      [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]];
    }
  }else if(act==="down"){
    const arr = db.accounts[acc];
    if(idx < arr.length-1){
      [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
    }
  }
  saveDB();
  renderAccounts();
  renderDogs();
}

/* ========== 匯入 / 匯出 ========== */
function exportJSON(){
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "晴天小狗-帳號狗狗備份.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(e){
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!data.accounts || typeof data.accounts !== "object"){ throw new Error("格式不符"); }
      db = { accounts: data.accounts, selected: data.selected || null };
      saveDB();
      renderAccounts(); renderDogs();
      alert("匯入完成！");
    }catch(err){
      alert("匯入失敗：檔案格式不正確。");
    }
  };
  reader.readAsText(file, "utf-8");
}

/* ========== 工具 ========== */
function escapeHTML(s){
  return (s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&gt;','>':'&lt;','"':'&quot;',"'":'&#39;'}[m]));
}
