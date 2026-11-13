const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const USERS={gef:{n:'Gef',c:'#2F7F86'},jini:{n:'Jini',c:'#B3265B'}};
const ALBUMS=['Trips','Dates','Home','Anniversary'];
let items=[],trash=[];
let nextId=100,view='timeline',album=null,query='',user=null,userKey=null,who='all',lbList=[],lbIdx=0;
let backgroundTrack=null,musicError='',musicNotice='',musicCoverNotice='';

/* login */
let pick=null;
document.querySelectorAll('.av').forEach(b=>b.onclick=()=>{pick=b.dataset.u;document.querySelectorAll('.av').forEach(x=>x.setAttribute('aria-pressed',x===b));$('#pw').focus()});
$('#eye').onclick=()=>{const p=$('#pw'),s=p.type==='password';p.type=s?'text':'password';$('#eye').textContent=s?'Hide':'Show'};
function enter(k){pick=k;user=USERS[k];userKey=k;$('#login').classList.add('hide');$('#app').classList.remove('hide');$('#mei').textContent=user.n[0];$('#mei').style.background=user.c;$('#men').textContent=user.n;render();refreshSharedMusic(true).catch(showMusicError);toast('Welcome back, '+user.n)}
function bad(msg){$('#err').textContent=msg;const c=$('#lform');c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake')}
$('#lform').onsubmit=async e=>{e.preventDefault();
  if(!sb)return bad('Add your Supabase URL and key in config.js first.');
  if(!pick||!$('#pw').value)return bad(!pick?'Tap your name first.':'Enter your password.');
  const btn=$('#lform .btn');btn.disabled=true;
  try{const r=await signIn(pick,$('#pw').value);if(!r.ok)return bad(r.msg);
    await loadItems();$('#err').textContent='';enter(pick)}
  catch(x){bad('Could not load your gallery: '+x.message+' (did you run setup.sql?)')}
  finally{btn.disabled=false}};
$('#me').onclick=()=>{if(sb)sb.auth.signOut();const audio=$('#musicPlayer');audio.pause();audio.removeAttribute('src');audio.load();backgroundTrack=null;$('#musicBar').classList.add('hide');$('#app').classList.add('hide');$('#login').classList.remove('hide');$('#pw').value='';$('#err').textContent=''};
$('#theme').onclick=()=>{const r=document.documentElement,dark=r.dataset.theme?r.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;r.dataset.theme=dark?'light':'dark';ST.theme=r.dataset.theme;saveState()};

function showMusicError(error){
  musicError=/background_music|schema cache/i.test(error.message)
    ?'Check that background_music has path, title, and cover_path columns and the authenticated read/insert/update/delete policies.'
    :'Could not load shared music: '+error.message;
  if(view==='settings')render();
  toast(musicError)
}
async function refreshSharedMusic(autoplay){
  const track=await loadBackgroundMusic(),audio=$('#musicPlayer'),bar=$('#musicBar');
  backgroundTrack=track;musicError='';
  if(!track){audio.pause();audio.removeAttribute('src');audio.dataset.path='';audio.load();bar.classList.add('hide');if(view==='settings')render();return}
  if(audio.dataset.path!==track.path){audio.src=track.url;audio.dataset.path=track.path;audio.load()}
  $('#musicCover').src=track.coverUrl||'assets/app-bg.jpg';
  $('#musicName').textContent=track.title||'Our shared song';
  $('#musicStatus').textContent='';
  bar.classList.remove('hide');
  if(autoplay){
    try{await audio.play()}
    catch{$('#musicStatus').textContent='Autoplay blocked — press Play.'}
  }
  if(view==='settings')render()
}
$('#musicPlayer').onplay=()=>{$('#musicStatus').textContent='Now playing'};
$('#musicPlayer').onpause=()=>{$('#musicStatus').textContent='Paused'};

/* helpers */
function toast(m,undo){const t=el('div','toast',m);t.setAttribute('role','status');
  if(undo){const b=el('button','','Undo');b.style.cssText='margin-left:.8rem;border:0;background:none;color:var(--acc);font-weight:700';b.onclick=()=>{undo();t.remove()};t.append(b)}
  document.body.append(t);setTimeout(()=>t.remove(),undo?6000:2200)}
const bg=i=>`linear-gradient(145deg,hsl(${i.h} 68% 64%),hsl(${(i.h+45)%360} 58% 38%))`;
function mediaEl(i,big){
  if(i.src){const m=el(i.k==='v'?'video':'img');m.src=i.src;if(i.k==='v'){m.muted=true;m.preload='metadata';if(big){m.controls=true;m.muted=false}}else m.alt=i.t;return m}
  const p=el('div','ph');p.style.background=bg(i);p.style.aspectRatio='1/'+i.r;return p}
function match(i){if(who!=='all'&&i.u!==who)return false;const q=query.trim().toLowerCase();if(!q)return true;
  const mo=new Date(i.d+'T00:00').toLocaleDateString('en',{month:'long',year:'numeric'}).toLowerCase();
  return (i.t+' '+i.a+' '+mo).toLowerCase().includes(q)}
function tile(i,list){
  const w=el('div');w.style.position='relative';
  const b=el('button','tile');b.setAttribute('aria-label','Open '+i.t);b.append(mediaEl(i,false));
  if(i.k==='v')b.append(el('span','badge','▶ '+(i.dur||'Video')));
  b.append(el('span','cap',i.t));const U=USERS[i.u];if(U){const up=el('span','up',U.n[0]);up.style.background=U.c;up.title='Uploaded by '+U.n;b.append(up)}b.onclick=()=>openLb(list,list.indexOf(i));
  const h=el('button','heart'+(i.fav?' on':''),i.fav?'♥':'♡');h.setAttribute('aria-label',i.fav?'Remove favorite':'Add favorite');
  h.onclick=e=>{e.stopPropagation();i.fav=!i.fav;persist(i);render()};
  w.style.breakInside='avoid';w.append(b,h);return w}
function grid(list){const g=el('div','mas');list.forEach(i=>g.append(tile(i,list)));return g}

/* views */
function render(){
  const tabs=[['timeline','Timeline'],['calendar','Calendar'],['albums','Albums'],['favs','Favorites'],['trash','Deleted'],['settings','Storage']];
  [$('#tabs'),$('#btabs')].forEach(c=>{c.replaceChildren();tabs.forEach(([k,l])=>{const b=el('button','',l);if(view===k||(k==='albums'&&album))b.setAttribute('aria-current','page');b.onclick=()=>{view=k;album=null;render()};c.append(b)})});
  const m=$('#main');m.replaceChildren();if((view!=='albums'&&view!=='calendar'&&view!=='settings'&&view!=='trash')||album){const f=el('div','fl');[['all','Everyone'],['gef','Gef'],['jini','Jini']].forEach(([k,l])=>{const b=el('button','',k==='all'?l:'By '+l);b.setAttribute('aria-pressed',who===k);b.onclick=()=>{who=k;render()};f.append(b)});m.append(f)}
  const sorted=[...items].sort((a,b)=>b.d.localeCompare(a.d)).filter(match);
  const hero=(t,p)=>{const h=el('div','hero');const d=el('div');d.append(el('h2','',t),el('p','',p));h.append(d);return h};
  if(view==='calendar'){m.append(hero('Our calendar','Together since December 10, 2024.'),calendarView());return}
  if(album){const l=sorted.filter(i=>i.a===album);const h=hero(album,l.length+' memories');const back=el('button','btn ghost','Back to albums');back.onclick=()=>{album=null;render()};const ren=el('button','btn','Rename');ren.onclick=()=>nameDialog('Rename album',album,v=>{const old=album;
    renameAlbumDB(old,v).then(()=>{[...items,...trash].forEach(i=>{if(i.a===old)i.a=v});ALBUMS[ALBUMS.indexOf(old)]=v;album=v;render();toast('Renamed to "'+v+'"')}).catch(x=>toast(x.message))});const bg2=el('div');bg2.style.cssText='display:flex;gap:.5rem;flex-wrap:wrap';bg2.append(ren,back);h.append(bg2);m.append(h);m.append(l.length?grid(l):empty());return}
  if(view==='trash'){m.append(hero('Recently deleted','Items wait here for 30 days, then they are removed for good.'),trashView());return}
  if(view==='settings'){m.append(hero('Storage & backup','Where your memories live, and where the safety copy goes.'),settingsView());return}
  if(view==='albums'){const ah=hero('Albums','Group your memories by story.');const nb=el('button','btn','+ New album');nb.onclick=()=>nameDialog('New album','',v=>{createAlbumDB(v).then(()=>{render();toast('Album "'+v+'" created')}).catch(x=>toast(x.message))});ah.append(nb);m.append(ah);const g=el('div','albums');
    ALBUMS.forEach(a=>{const l=items.filter(i=>i.a===a),row=ALBUMROWS.find(x=>x.name===a);
      const cover=row&&row.cover_media_id?[...items,...trash].find(i=>i.id===row.cover_media_id):null;
      const b=el('div','alb'),open=el('div','alb-open');
      const c=cover?mediaEl(cover,false):l[0]?mediaEl({...l[0],src:null}):el('div','ph');
      if(!cover&&!l[0])c.style.background='var(--line)';c.style.aspectRatio='auto';c.style.height='150px';
      const t=el('div','t');t.append(el('h3','',a),el('small','',l.length+' items'));open.append(c,t);
      open.setAttribute('role','button');open.setAttribute('aria-label','Open album '+a);open.tabIndex=0;
      open.onclick=()=>{album=a;render()};open.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open.click()}};
      const choose=el('button','btn ghost album-cover-button','Choose cover');choose.type='button';choose.onclick=()=>coverDialog(a);
      b.append(open,choose);g.append(b)});m.append(g);return}
  if(view==='favs'){const l=sorted.filter(i=>i.fav);m.append(hero('Favorites',l.length+' hearts'));m.append(l.length?grid(l):empty('Tap the heart on any photo or video to keep it here.'));return}
  m.append(hero('Our timeline',sorted.length+' photos and videos'));
  if(!sorted.length){m.append(empty());return}
  const by={};sorted.forEach(i=>(by[i.d.slice(0,7)]??=[]).push(i));
  Object.keys(by).sort().reverse().forEach(k=>{const h=el('h3','mo',new Date(k+'-01T00:00').toLocaleDateString('en',{month:'long',year:'numeric'}));h.append(el('span','',by[k].length+' items'));m.append(h,grid2(by[k],sorted))})
}
function grid2(list,all){const g=el('div','mas');list.forEach(i=>g.append(tile(i,all)));return g}
function empty(t){const e=el('div','empty',t||'Nothing here yet. Tap + to upload your first memory.');return e}

function coverDialog(name){
  const photos=items.filter(i=>i.a===name&&i.k!=='v');
  const ov=el('div','ov'),md=el('div','modal');md.setAttribute('role','dialog');md.setAttribute('aria-label','Choose cover for '+name);
  md.append(el('h2','', 'Choose a cover for '+name),el('p','calendar-legend','Upload a new cover from your device, or choose a photo already in this album.'));
  const error=el('p','err');error.setAttribute('role','alert');error.style.overflowWrap='anywhere';
  const options=el('div','cover-options');
  const close=()=>ov.remove();
  const setCover=async mediaId=>{
    try{await setAlbumCoverDB(name,mediaId);close();render();toast(mediaId?'Album cover updated.':'Album cover removed.')}
    catch(e){
      error.textContent=/cover_media_id|schema cache/i.test(e.message)
        ?"Supabase needs the album-cover database update. In Supabase SQL Editor, run: alter table public.albums add column if not exists cover_media_id uuid references public.media(id) on delete set null; then run: NOTIFY pgrst, 'reload schema';"
        :'Could not update album cover: '+e.message
    }
  };
  const fileInput=el('input');fileInput.type='file';fileInput.accept='image/*';fileInput.className='hide';
  const upload=el('button','btn','Upload cover photo');upload.type='button';
  const uploadNote=el('p','calendar-legend cover-upload-note','The uploaded image will also be added to this album.');
  upload.onclick=()=>fileInput.click();
  fileInput.onchange=async()=>{
    const file=fileInput.files&&fileInput.files[0];
    if(!file)return;
    if(!file.type.startsWith('image/')){error.textContent='Choose an image file for the album cover.';fileInput.value='';return}
    upload.disabled=true;error.textContent='Uploading cover photo...';
    const photo={id:uid(),t:file.name.replace(/\.[^.]+$/,''),d:localDateKey(new Date(file.lastModified||Date.now())),uploadedOn:localDateKey(new Date()),k:'p',a:name,blob:file,src:URL.createObjectURL(file),fav:false,u:userKey};
    items.push(photo);
    try{
      await persist(photo);
      await setAlbumCoverDB(name,photo.id);
      close();render();toast('Cover uploaded and set.')
    }catch(e){
      if(!PATHS[photo.id])items.splice(items.indexOf(photo),1);
      render();
      error.textContent=/cover_media_id|schema cache/i.test(e.message)
        ?"The photo was uploaded, but Supabase needs the album-cover database update. Run the updated supabase/setup.sql in Supabase SQL Editor, then try selecting the uploaded photo as the cover."
        :'Could not upload or set album cover: '+e.message
    }finally{
      upload.disabled=false;fileInput.value=''
    }
  };
  md.append(upload,uploadNote,fileInput);
  photos.forEach(photo=>{
    const option=el('button','cover-option');option.type='button';option.setAttribute('aria-label','Use '+photo.t+' as album cover');
    const image=mediaEl(photo,false);image.className='cover-thumb';option.append(image,el('span','cover-option-title',photo.t));
    option.onclick=()=>setCover(photo.id);options.append(option)
  });
  if(!photos.length)options.append(empty('Add a photo to this album before choosing a cover.'));
  const actions=el('div','mrow'),clear=el('button','btn ghost','Use default cover'),cancel=el('button','btn','Done');
  clear.type=cancel.type='button';clear.onclick=()=>setCover(null);cancel.onclick=close;actions.append(clear,cancel);
  md.append(options,error,actions);ov.append(md);ov.onclick=e=>{if(e.target===ov)close()};document.body.append(ov)
}

function calendarView(){
  const start=Date.UTC(2024,11,10),now=new Date(),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const daysTogether=Math.floor((today-start)/864e5)+1;
  const uploadsByDate={};
  [...items,...trash].forEach(it=>{if(it.uploadedOn)uploadsByDate[it.uploadedOn]=(uploadsByDate[it.uploadedOn]||0)+1});
  const w=el('section','calendar-wrap'),count=el('div','sc together-count');
  count.append(el('span','calendar-kicker','EVERY DAY, A LITTLE MORE'),el('strong','',daysTogether.toLocaleString()+' days together'),el('p','','Our story began on December 10, 2024.'));
  const cal=el('div','sc calendar-card'),nav=el('div','calendar-nav');
  let year=now.getFullYear(),month=now.getMonth();
  const title=el('h3','calendar-month'),prev=el('button','calendar-arrow','‹'),next=el('button','calendar-arrow','›');
  prev.type=next.type='button';prev.setAttribute('aria-label','Previous month');next.setAttribute('aria-label','Next month');
  const grid=el('div','calendar-grid');
  const draw=()=>{
    title.textContent=new Date(Date.UTC(year,month,1)).toLocaleDateString('en',{month:'long',year:'numeric',timeZone:'UTC'});
    prev.disabled=year===2024&&month===11;
    grid.replaceChildren();
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(day=>{const d=el('span','calendar-weekday',day);d.setAttribute('aria-hidden','true');grid.append(d)});
    const firstDay=new Date(Date.UTC(year,month,1)).getUTCDay(),monthLength=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    for(let i=0;i<firstDay;i++)grid.append(el('span','calendar-blank'));
    for(let day=1;day<=monthLength;day++){
      const date=Date.UTC(year,month,day),isMonthsary=day===10&&date>=start,isToday=date===today;
      const dateKey=[year,String(month+1).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
      const uploadCount=uploadsByDate[dateKey]||0;
      const cell=el('div','calendar-day'+(isMonthsary?' monthsary':'')+(isToday?' today':'')+(uploadCount?' has-uploads':''));
      cell.append(el('span','calendar-number',String(day)));
      if(isMonthsary)cell.append(el('small','calendar-label','♥ Monthsary'));
      if(uploadCount)cell.append(el('small','calendar-upload-count',uploadCount+' upload'+(uploadCount===1?'':'s')));
      if(uploadCount)cell.title=uploadCount+' upload'+(uploadCount===1?'':'s')+' on this date';
      if(isToday)cell.setAttribute('aria-current','date');
      grid.append(cell);
    }
  };
  prev.onclick=()=>{month--;if(month<0){month=11;year--}draw()};
  next.onclick=()=>{month++;if(month>11){month=0;year++}draw()};
  nav.append(prev,title,next);cal.append(nav,grid);
  const key=el('p','calendar-legend');
  key.append(el('span','calendar-heart','♥'),document.createTextNode(' Every 10th is our monthsary'));
  const uploadKey=el('p','calendar-legend');uploadKey.append(el('span','calendar-upload-key','●'),document.createTextNode(' Dates with uploaded photos or videos'));
  w.append(count,cal,key,uploadKey);draw();return w
}

/* album names */
function nameDialog(title,init,ok){
  const ov=el('div','ov'),md=el('div','modal');md.setAttribute('role','dialog');md.setAttribute('aria-label',title);
  md.append(el('h2','',title));
  const inp=el('input','nm');inp.value=init;inp.maxLength=40;inp.placeholder='Album name';inp.setAttribute('aria-label','Album name');
  const er=el('p','err');er.style.margin='.5rem 0 0';
  const c=el('button','btn ghost','Cancel');c.onclick=()=>ov.remove();const sv=el('button','btn','Save');
  const go=()=>{const v=inp.value.trim();if(!v){er.textContent='Give it a name.';return}
    if(ALBUMS.some(a=>a.toLowerCase()===v.toLowerCase()&&a!==init)){er.textContent='You already have an album with that name.';return}
    ov.remove();if(v!==init)ok(v)};
  sv.onclick=go;inp.onkeydown=e=>{if(e.key==='Enter')go();if(e.key==='Escape')ov.remove()};
  const r=el('div','mrow');r.style.justifyContent='flex-end';r.append(c,sv);
  md.append(inp,er,r);ov.append(md);ov.onclick=e=>{if(e.target===ov)ov.remove()};document.body.append(ov);inp.focus();inp.select()}
/* recently deleted */
function trashView(){
  const w=el('div');
  if(!trash.length){w.append(empty('Nothing here. Deleted photos and videos wait here for 30 days.'));return w}
  const g=el('div','mas');
  trash.forEach(it=>{
    const t=el('div','tile');t.style.cursor='default';t.append(mediaEl(it,false));
    t.append(el('span','cap',it.t+' · '+Math.max(0,30-Math.floor((Date.now()-it.del)/864e5))+' days left'));
    const bar=el('div','tr');
    const rs=el('button','btn','Restore');rs.onclick=()=>{trash.splice(trash.indexOf(it),1);delete it.del;items.push(it);persist(it);render();toast('Restored')};
    const fo=el('button','btn ghost','Delete forever');fo.onclick=()=>{if(!confirm('Delete forever? This cannot be undone.'))return;trash.splice(trash.indexOf(it),1);dbDel(it.id);render()};
    bar.append(rs,fo);const wrap=el('div');wrap.style.cssText='break-inside:avoid;margin-bottom:.7rem';wrap.append(t,bar);g.append(wrap)});
  w.append(g);return w}
/* storage & settings */
function card(t,d){const c=el('div','sc');c.append(el('h3','',t),el('p','',d));return c}
function settingsView(){
  const w=el('div','set');
  const a=card('Where your files live','Photos and videos are saved in your Supabase project, so Gef and Jini see the same gallery on any device. Now: '+items.length+' items, and '+trash.length+' in Recently deleted.');
  const lb=el('button','btn','Download list backup');lb.onclick=exportList;
  const tip=el('p','','Tip: open any photo or video and tap Download to save the original file. See your used space in Supabase under Storage.');
  tip.style.marginTop='.8rem';a.append(lb,tip);
  const p=card('Change my password','Signed in as '+user.n+'. Use 12 or more characters.');
  const o=el('input'),n=el('input'),msg=el('p','err');
  [o,n].forEach((x,i)=>{x.type='password';x.placeholder=i?'New password':'Current password';x.className='nm';x.autocomplete=i?'new-password':'current-password'});
  const pb=el('button','btn','Change password');pb.style.marginTop='.6rem';
  pb.onclick=async()=>{const r=await changePw(userKey,o.value,n.value);msg.textContent=r.ok?'':r.msg;if(r.ok){o.value=n.value='';toast('Password changed')}};
  p.append(o,n,msg,pb);
  w.append(a,musicSettingsView(),p);return w}
function musicSettingsView(){
  const c=card('Shared background music','Upload an MP3 and its cover photo. The player stays docked on the side; browsers may require you to press Play.');
  const current=el('p','music-current',backgroundTrack?'Current song: '+backgroundTrack.title:'No shared song uploaded yet.');
  const input=el('input','nm');input.type='file';input.accept='.mp3,audio/mpeg';input.setAttribute('aria-label','Choose an MP3 file');
  const selected=el('p','music-selection','Choose an MP3 file above, then click Upload MP3.');selected.setAttribute('aria-live','polite');
  const msg=el('p','music-message');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');msg.textContent=musicError||musicNotice;
  const upload=el('button','btn','Upload MP3');upload.type='button';
  let uploading=false;
  const uploadSelectedFile=async()=>{
    const file=input.files&&input.files[0];
    if(uploading)return;
    if(!file){musicNotice='Choose an MP3 file first.';msg.textContent=musicNotice;toast(musicNotice);return}
    if(!/\.mp3$/i.test(file.name)){musicNotice='That file does not have an .mp3 extension. Choose an MP3 file.';msg.textContent=musicNotice;toast(musicNotice);return}
    uploading=true;upload.disabled=true;musicNotice='Uploading "'+file.name+'" to shared storage...';msg.textContent=musicNotice;
    try{
      backgroundTrack=await uploadBackgroundMusic(file);
      musicError='';musicNotice='MP3 uploaded and saved for both of you.';
      current.textContent='Current song: '+backgroundTrack.title;
      input.value='';selected.textContent='Saved: '+file.name;
      msg.textContent=musicNotice;
      try{await refreshSharedMusic(true)}
      catch(error){musicNotice='MP3 saved for both of you, but the player could not load it: '+error.message}
      render();toast(musicNotice)
    }catch(error){
      musicError=/background_music|schema cache/i.test(error.message)
        ?'MP3 upload failed: Supabase cannot access the background_music table. Check its authenticated policies and table columns.'
        :'MP3 upload failed: '+error.message;
      musicNotice='';msg.textContent=musicError;toast(musicError)
    }finally{
      uploading=false;upload.disabled=false
    }
  };
  input.onchange=()=>{
    const file=input.files&&input.files[0];
    musicNotice='';msg.textContent='';
    if(!file){selected.textContent='Choose an MP3 file to upload it automatically.';return}
    selected.textContent='Selected: '+file.name+' ('+(file.size/1048576).toFixed(2)+' MB). Upload starting...';
    uploadSelectedFile()
  };
  upload.onclick=uploadSelectedFile;
  const row=el('div','music-actions');row.append(upload);
  if(backgroundTrack){
    const remove=el('button','btn ghost','Remove song');remove.type='button';
    remove.onclick=async()=>{
      if(!confirm('Remove the shared song for both of you?'))return;
      remove.disabled=true;
      try{await removeBackgroundMusic();backgroundTrack=null;musicError='';await refreshSharedMusic(false);render();toast('Shared song removed.')}
      catch(error){msg.textContent='Could not remove the shared song: '+error.message;remove.disabled=false}
    };
    row.append(remove)
  }
  c.append(current,input,selected,msg,row);
  const coverInput=el('input','nm');coverInput.type='file';coverInput.accept='image/*';coverInput.setAttribute('aria-label','Choose cover photo for shared music');
  const coverSelected=el('p','music-selection',backgroundTrack&&backgroundTrack.coverUrl?'A cover photo is set. Choose another image to replace it.':'Choose a cover photo after uploading the MP3.');
  const coverMsg=el('p','music-message');coverMsg.setAttribute('role','status');coverMsg.setAttribute('aria-live','polite');coverMsg.textContent=musicCoverNotice;
  coverInput.disabled=!backgroundTrack;
  coverInput.onchange=async()=>{
    const file=coverInput.files&&coverInput.files[0];
    if(!file)return;
    if(!file.type.startsWith('image/')){coverMsg.textContent='Choose an image file for the music cover.';coverInput.value='';return}
    coverInput.disabled=true;coverMsg.textContent='Uploading cover photo...';
    try{
      await uploadBackgroundMusicCover(file);
      musicCoverNotice='Cover photo saved for both of you.';
      coverSelected.textContent='Cover saved: '+file.name;
      await refreshSharedMusic(false);render()
    }catch(error){
      coverMsg.textContent=/cover_path|schema cache/i.test(error.message)
        ?'Supabase needs the cover_path column on background_music. Add it in Table Editor, then try again.'
        :'Could not save the music cover: '+error.message;
      musicCoverNotice=coverMsg.textContent;
      coverInput.disabled=false
    }finally{coverInput.value=''}
  };
  const coverTitle=el('h3','','Player cover photo');coverTitle.style.marginTop='1.2rem';
  c.append(coverTitle,coverInput,coverSelected,coverMsg);return c
}
function openLb(list,i){lbList=list;lbIdx=i;drawLb()}
function drawLb(){document.querySelector('.lb')?.remove();const it=lbList[lbIdx];if(!it)return;
  const lb=el('div','lb');lb.setAttribute('role','dialog');lb.setAttribute('aria-label',it.t);
  const top=el('div','bar2');const x=el('button','x','Close');x.onclick=closeLb;
  const hb=el('button','x',it.fav?'♥ Favorited':'♡ Favorite');hb.onclick=()=>{it.fav=!it.fav;persist(it);drawLb();render()};const del=el('button','x','Delete');
  del.onclick=()=>{if(!confirm('Move "'+it.t+'" to Recently deleted? You can restore it for 30 days.'))return;
    const at=items.indexOf(it);items.splice(at,1);it.del=Date.now();trash.push(it);persist(it);closeLb();render();
    toast('Moved to Recently deleted',()=>{trash.splice(trash.indexOf(it),1);delete it.del;items.splice(at,0,it);persist(it);render()})};
  const dlb=el('button','x','Download');dlb.onclick=()=>downloadItem(it);
  top.append(x,hb,dlb,del);
  const st=el('div','st');
  if(it.k==='v'&&!it.src){const p=mediaEl(it);p.style.display='grid';p.style.placeItems='center';p.append(el('span','', '▶ '+it.dur));p.lastChild.style.cssText='font-size:2rem';st.append(p)}else st.append(mediaEl(it,true));
  const pv=el('button','nv','‹'),nx=el('button','nv','›');pv.style.left='.6rem';nx.style.right='.6rem';pv.setAttribute('aria-label','Previous');nx.setAttribute('aria-label','Next');
  pv.onclick=()=>step(-1);nx.onclick=()=>step(1);
  const ft=el('div','ft');ft.append(el('h3','',it.t),el('small','',new Date(it.d+'T00:00').toLocaleDateString('en',{dateStyle:'long'})+' · '+it.a+' · Uploaded by '+(USERS[it.u]?USERS[it.u].n:'Unknown')));
  lb.append(top,st,pv,nx,ft);document.body.append(lb);x.focus()}
function step(n){lbIdx=(lbIdx+n+lbList.length)%lbList.length;drawLb()}
function closeLb(){document.querySelector('.lb')?.remove()}
document.addEventListener('keydown',e=>{if(!document.querySelector('.lb'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1)});

/* upload */
$('#q').oninput=e=>{query=e.target.value;render()};
$('#fab').onclick=openUpload;
function openUpload(){
  const ov=el('div','ov'),md=el('div','modal');md.setAttribute('role','dialog');md.setAttribute('aria-label','Upload');
  md.append(el('h2','','Add to our story'));
  const dz=el('label','drop');dz.append(el('div','', 'Drop photos and videos here, or tap to choose'));
  const inp=el('input');inp.type='file';inp.multiple=true;inp.accept='image/*,video/*';inp.className='hide';dz.append(inp);
  const list=el('div'),files=[];let done=0;
  const add=el('button','btn','Add to gallery');add.disabled=true;
  const sel=el('select');ALBUMS.forEach(a=>sel.append(new Option(a,a)));sel.setAttribute('aria-label','Album');if(album)sel.value=album;
  const cancel=el('button','btn ghost','Cancel');cancel.onclick=()=>ov.remove();
  function take(fl){[...fl].forEach(f=>{if(!/^(image|video)\//.test(f.type))return;files.push(f);
    const r=el('div','row');r.append(el('span','',f.name));const b=el('div','bar'),i=el('i');b.append(i);r.append(b);list.append(r);
    let p=0;const t=setInterval(()=>{p+=Math.random()*28+8;if(p>=100){p=100;clearInterval(t);done++;add.disabled=done<files.length}i.style.width=p+'%'},180)})}
  inp.onchange=()=>take(inp.files);
  ['dragover','dragenter'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('over')}));
  ['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('over')}));
  dz.addEventListener('drop',e=>take(e.dataTransfer.files));
  add.onclick=()=>{files.forEach(f=>{const it={id:uid(),t:f.name.replace(/\.[^.]+$/,''),d:new Date(f.lastModified||Date.now()).toISOString().slice(0,10),uploadedOn:localDateKey(new Date()),k:f.type.startsWith('video')?'v':'p',a:sel.value,blob:f,src:URL.createObjectURL(f),fav:false,u:userKey};items.push(it);persist(it).catch(x=>{const at=items.indexOf(it);if(at>-1)items.splice(at,1);render();toast('Upload failed: '+(x.message||x))})});
    ov.remove();view='timeline';album=null;render();toast(files.length+' added to '+sel.value)};
  const row=el('div','mrow');const r2=el('div');r2.style.cssText='display:flex;gap:.5rem;align-items:center';r2.append(el('span','', 'Album'),sel);const r3=el('div');r3.style.cssText='display:flex;gap:.5rem';r3.append(cancel,add);row.append(r2,r3);
  md.append(dz,list,row);ov.append(md);ov.onclick=e=>{if(e.target===ov)ov.remove()};document.body.append(ov)}

/* start */
(async function init(){
  ST=loadState();if(ST.theme)document.documentElement.dataset.theme=ST.theme;
  if(!sb){$('#err').textContent='Add your Supabase URL and key in config.js first.';return}
  const {data}=await sb.auth.getSession();
  if(data.session){const k=data.session.user.email.split('@')[0];
    if(USERS[k]){try{await loadItems();enter(k)}catch(e){$('#err').textContent='Could not load: '+e.message}}}
  window.addEventListener('focus',async()=>{if(userKey){try{await loadItems();render()}catch(e){}}});
})();
