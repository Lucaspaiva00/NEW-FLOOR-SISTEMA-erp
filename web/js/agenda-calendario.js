(() => {
 const raiz=document.getElementById("listaAgenda");
 if(!raiz)return;
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const pad=n=>String(n).padStart(2,"0");
 const dayKey=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join("-");
 const dateAt=(date,hour=0,minute=0)=>new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute);
 const addDays=(date,n)=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate(),12);d.setDate(d.getDate()+n);return d;};
 const monday=date=>{const d=dateAt(date,12);return addDays(d,-(d.getDay()+6)%7);};
 const start=e=>{const d=new Date(e.dataInicio);return Number.isNaN(d.getTime())?null:d;};
 const finish=e=>{const d=new Date(e.dataFim||e.dataInicio);return Number.isNaN(d.getTime())?start(e):d;};
 const parseColor=cor=>/^#[0-9a-fA-F]{6}$/.test(String(cor))?cor:"#2563eb";
 const fmt={month:new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}),day:new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),short:new Intl.DateTimeFormat("pt-BR",{weekday:"short",day:"2-digit",month:"short"}),time:new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}),weekday:new Intl.DateTimeFormat("pt-BR",{weekday:"short"})};
 const state={view:localStorage.getItem("erp-agenda-vista")||"mes",cursor:new Date(),events:[]};
 if(!["mes","semana","dia","lista"].includes(state.view))state.view="mes";
 const container=document.createElement("section");container.className="erp-calendario";container.setAttribute("aria-label","Calendário de compromissos");
 container.innerHTML='<div class="erp-cal-toolbar">'+
  '<div class="erp-cal-nav"><button type="button" id="erpCalHoje">Hoje</button><button aria-label="Período anterior" type="button" id="erpCalAnterior">‹</button><button aria-label="Próximo período" type="button" id="erpCalProximo">›</button><h2 id="erpCalPeriodo"></h2></div>'+
  '<div class="erp-cal-views" role="group" aria-label="Visualização do calendário"><button data-cal-view="mes" type="button">Mês</button><button data-cal-view="semana" type="button">Semana</button><button data-cal-view="dia" type="button">Dia</button><button data-cal-view="lista" type="button">Lista</button></div></div>'+
  '<div id="erpCalGrade" class="erp-cal-grade" aria-live="polite"></div>';
 raiz.before(container);
 const grade=container.querySelector("#erpCalGrade");
 const title=container.querySelector("#erpCalPeriodo");
 const eventsOnDate=(d)=>{
  const startDay=dateAt(d).getTime(),endDay=dateAt(addDays(d,1)).getTime();
  return state.events.filter(e=>{
   const a=start(e),b=finish(e);
   return a && a.getTime()<endDay && (b&&b.getTime()>startDay || a.getTime()>=startDay);
  }).sort((a,b)=>start(a)-start(b));
 };
 const eventHTML=(e)=>{
  const d=start(e),horario=d?fmt.time.format(d):"--:--";
  return '<button type="button" class="erp-cal-event" data-cal-event="'+Number(e.agendaid)+
   '" style="--erp-cor:'+parseColor(e.cor)+'" title="'+esc((e.titulo||"Compromisso")+" · "+horario)+'">'+
   '<span class="erp-cal-event-time">'+horario+'</span> <span>'+esc(e.titulo||"Compromisso")+'</span></button>';
 };
 function monthView(){
  const first=new Date(state.cursor.getFullYear(),state.cursor.getMonth(),1,12);
  const initial=monday(first);
  const days=Array.from({length:42},(_,i)=>addDays(initial,i));
  const weekdays=Array.from({length:7},(_,i)=>fmt.weekday.format(addDays(initial,i)).replace(".",""));
  let out='<div class="erp-cal-month">';
  for(const wd of weekdays)out+='<div class="erp-cal-weekday">'+esc(wd)+'</div>';
  for(const d of days){
   const events=eventsOnDate(d), today=dayKey(d)===dayKey(new Date());
   out+='<div class="erp-cal-date'+(d.getMonth()===state.cursor.getMonth()?'':' erp-cal-outside')+
     (today?' erp-cal-today':'')+'"><button type="button" class="erp-cal-date-btn" data-cal-day="'+dayKey(d)+
     '" aria-label="Adicionar evento em '+dayKey(d)+'">'+d.getDate()+'</button>'+
     '<div class="erp-cal-events">'+events.slice(0,3).map(eventHTML).join("")+
     (events.length>3?'<button type="button" class="erp-cal-more" data-cal-dayview="'+dayKey(d)+'">+'+(events.length-3)+' compromissos</button>':"")+
     '</div></div>';
  }
  return out+"</div>";
 }
 function singleDay(d){
  const events=eventsOnDate(d);
  const groups=new Map();
  for(const e of events){
   const hour=start(e)?.getHours()??7;
   const key=Math.max(7,Math.min(21,hour));
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push(e);
  }
  let html='<div class="erp-cal-hours">';
  for(let hour=7;hour<=21;hour++){
   html+='<div class="erp-cal-hour"><span>'+pad(hour)+':00</span><div class="erp-cal-hour-content" data-cal-hour="'+dayKey(d)+'T'+pad(hour)+':00">'+
    (groups.get(hour)||[]).map(eventHTML).join("")+'</div></div>';
  }
  if(!events.length)html+='<p class="erp-cal-empty">Nenhum compromisso nesta data. Clique em um horário para criar.</p>';
  return html+"</div>";
 }
 function weekView(){
  const first=monday(state.cursor);
  let out='<div class="erp-cal-week">';
  for(let i=0;i<7;i++){
   const d=addDays(first,i),events=eventsOnDate(d),today=dayKey(d)===dayKey(new Date());
   out+='<section class="erp-cal-week-day'+(today?' erp-cal-today':'')+'"><button type="button" class="erp-cal-week-title" data-cal-dayview="'+dayKey(d)+'">'+esc(fmt.short.format(d))+'</button>'+
    '<div class="erp-cal-week-events">'+(events.length?events.map(eventHTML).join(""):'<button type="button" class="erp-cal-add" data-cal-day="'+dayKey(d)+'">+ Compromisso</button>')+'</div></section>';
  }
  return out+"</div>";
 }
 function render(){
  container.querySelectorAll("[data-cal-view]").forEach(b=>{
   b.classList.toggle("active",b.dataset.calView===state.view);
   b.setAttribute("aria-pressed",String(b.dataset.calView===state.view));
  });
  raiz.hidden=state.view!=="lista";
  grade.hidden=state.view==="lista";
  if(state.view==="mes"){title.textContent=fmt.month.format(state.cursor);grade.innerHTML=monthView();}
  if(state.view==="semana"){
   const first=monday(state.cursor),last=addDays(first,6);
   title.textContent=fmt.short.format(first)+" — "+fmt.short.format(last);
   grade.innerHTML=weekView();
  }
  if(state.view==="dia"){title.textContent=fmt.day.format(state.cursor);grade.innerHTML=singleDay(state.cursor);}
  if(state.view==="lista"){title.textContent="Lista de compromissos";grade.innerHTML="";}
 }
 function escolherView(view){
  state.view=view;
  localStorage.setItem("erp-agenda-vista",view);
  render();
 }
 function criarEm(dateStr){
  const d=new Date(dateStr+"T12:00:00");
  if(Number.isNaN(d.getTime()))return;
  const ini=document.getElementById("dataInicio"),fim=document.getElementById("dataFim");
  if(ini)ini.value=dayKey(d)+"T09:00";
  if(fim)fim.value=dayKey(d)+"T10:00";
  const modal=document.getElementById("modalAgenda");
  if(modal)bootstrap.Modal.getOrCreateInstance(modal).show();
 }
 container.addEventListener("click",event=>{
  const btn=event.target.closest("button");
  if(!btn)return;
  if(btn.dataset.calView){escolherView(btn.dataset.calView);return;}
  if(btn.dataset.calDayview){state.cursor=new Date(btn.dataset.calDayview+"T12:00:00");escolherView("dia");return;}
  if(btn.dataset.calDay){criarEm(btn.dataset.calDay);return;}
  if(btn.dataset.calHour){criarEm(btn.dataset.calHour.slice(0,10));return;}
  if(btn.dataset.calEvent){
   const id=Number(btn.dataset.calEvent);
   if(Number.isInteger(id)&&typeof window.abrirModalAgenda==="function")window.abrirModalAgenda(id);
  }
 });
 container.querySelector("#erpCalHoje").onclick=()=>{state.cursor=new Date();render();};
 container.querySelector("#erpCalAnterior").onclick=()=>{
  const d=state.cursor;
  if(state.view==="mes")state.cursor=new Date(d.getFullYear(),d.getMonth()-1,1,12);
  else if(state.view==="semana")state.cursor=addDays(d,-7);
  else state.cursor=addDays(d,-1);
  render();
 };
 container.querySelector("#erpCalProximo").onclick=()=>{
  const d=state.cursor;
  if(state.view==="mes")state.cursor=new Date(d.getFullYear(),d.getMonth()+1,1,12);
  else if(state.view==="semana")state.cursor=addDays(d,7);
  else state.cursor=addDays(d,1);
  render();
 };
 window.addEventListener("erp-agenda-atualizada",event=>{
  state.events=Array.isArray(event.detail)?event.detail:[];render();
 });
 if(typeof agendaCache!=="undefined"&&Array.isArray(agendaCache))state.events=agendaCache;
 render();
})();