/* Shared cloud storage with Supabase. Only the public (publishable) key is used here. */
const sb=(window.supabase&&/^https:\/\//.test(SUPABASE_URL)&&SUPABASE_KEY&&!/PASTE/.test(SUPABASE_KEY))?window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY):null;
const DOMAIN='gefandjini.app';
const uid=()=>crypto.randomUUID?crypto.randomUUID():'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]&15;return(c==='x'?r:(r&3|8)).toString(16)});
const localDateKey=value=>{const d=new Date(value);return[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
let ST,ALBUMROWS=[],PATHS={};
function loadState(){let s={};try{s=JSON.parse(localStorage.getItem('gj_state')||'{}')}catch(e){}return{theme:null,...s}}
function saveState(){try{localStorage.setItem('gj_state',JSON.stringify({theme:ST.theme}))}catch(e){}}
const albumId=n=>(ALBUMROWS.find(a=>a.name===n)||{}).id||null;
const dupMsg=e=>e.code==='23505'?'You already have an album with that name.':e.message;
window.addEventListener('unhandledrejection',e=>{if(typeof toast==='function')toast('Problem: '+((e.reason&&e.reason.message)||e.reason))});

/* sign in: your name becomes a hidden email, e.g. gef@gefandjini.app */
async function signIn(u,pw){
  const {error}=await sb.auth.signInWithPassword({email:u+'@'+DOMAIN,password:pw});
  return error?{ok:false,msg:/invalid/i.test(error.message)?'Wrong name or password.':error.message}:{ok:true}}
async function changePw(u,old,nw){
  const r=await signIn(u,old);if(!r.ok)return r;
  if(nw.length<12)return{ok:false,msg:'New password needs 12 or more characters.'};
  const {error}=await sb.auth.updateUser({password:nw});return error?{ok:false,msg:error.message}:{ok:true}}

/* load everything shared between Gef and Jini */
async function loadItems(){
  const [m,a]=await Promise.all([
    sb.from('media').select('*').order('created_at',{ascending:false}).limit(500),
    sb.from('albums').select('*').order('created_at')]);
  if(m.error||a.error)throw (m.error||a.error);
  let rows=a.data;
  if(!rows.length){const ins=await sb.from('albums').insert(['Trips','Dates','Home','Anniversary'].map(name=>({name}))).select();if(!ins.error)rows=ins.data}
  ALBUMROWS=rows;ALBUMS.splice(0,ALBUMS.length,...rows.map(r=>r.name));
  let list=m.data;const cut=Date.now()-30*864e5;
  const old=list.filter(r=>r.deleted_at&&Date.parse(r.deleted_at)<cut);
  if(old.length){await sb.storage.from('media').remove(old.map(r=>r.path));await sb.from('media').delete().in('id',old.map(r=>r.id));list=list.filter(r=>!old.includes(r))}
  const {data:urls}=list.length?await sb.storage.from('media').createSignedUrls(list.map(r=>r.path),3600):{data:[]};
  items=[];trash=[];
  list.forEach((r,i)=>{
    const it={id:r.id,t:r.title||'Untitled',d:r.taken_on||r.created_at.slice(0,10),k:r.kind==='video'?'v':'p',
      uploadedOn:localDateKey(r.created_at),a:(rows.find(x=>x.id===r.album_id)||{}).name||'',u:r.uploader,fav:r.favorite,src:urls&&urls[i]&&urls[i].signedUrl,path:r.path};
    PATHS[r.id]=r.path;
    if(r.deleted_at){it.del=Date.parse(r.deleted_at);trash.push(it)}else items.push(it)})}

/* big files go up in 6 MB pieces and resume if the connection drops */
async function uploadFile(path,file,onp){
  const {data:{session}}=await sb.auth.getSession();
  if(file.size<=6*1048576||!window.tus){
    const {error}=await sb.storage.from('media').upload(path,file,{contentType:file.type||undefined});
    if(error)throw error;return}
  await new Promise((res,rej)=>{
    new tus.Upload(file,{
      endpoint:SUPABASE_URL.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable',
      retryDelays:[0,3000,5000,10000,20000],
      headers:{authorization:'Bearer '+session.access_token,apikey:SUPABASE_KEY,'x-upsert':'true'},
      uploadDataDuringCreation:true,removeFingerprintOnSuccess:true,chunkSize:6*1048576,
      metadata:{bucketName:'media',objectName:path,contentType:file.type||'application/octet-stream',cacheControl:3600},
      onError:rej,onProgress:(a,b)=>onp&&onp(Math.round(a/b*100)),onSuccess:res}).start()})}

/* save one item (new upload, or a change like favorite / album / deleted) */
async function persist(it){
  const row={title:it.t,favorite:!!it.fav,album_id:albumId(it.a),deleted_at:it.del?new Date(it.del).toISOString():null};
  if(it.blob&&!PATHS[it.id]){
    const path=it.u+'/'+it.id+'-'+(it.blob.name||'file').replace(/[^\w.-]/g,'_');
    let last=-1;
    await uploadFile(path,it.blob,p=>{const b=Math.floor(p/20);if(b!==last){last=b;toast('Uploading "'+it.t+'" '+p+'%')}});
    const {error}=await sb.from('media').insert({id:it.id,path,kind:it.k==='v'?'video':'photo',uploader:it.u,taken_on:it.d,...row});
    if(error){await sb.storage.from('media').remove([path]);throw error}
    PATHS[it.id]=path;it.path=path;delete it.blob;return}
  const {error}=await sb.from('media').update(row).eq('id',it.id);if(error)throw error}
async function dbDel(id){
  const p=PATHS[id];if(p)await sb.storage.from('media').remove([p]);
  const {error}=await sb.from('media').delete().eq('id',id);if(error)throw error;delete PATHS[id]}
async function createAlbumDB(name){
  const {data,error}=await sb.from('albums').insert({name,created_by:userKey}).select().single();
  if(error)throw new Error(dupMsg(error));ALBUMROWS.push(data);ALBUMS.push(name)}
async function renameAlbumDB(old,nw){
  const id=albumId(old);const {error}=await sb.from('albums').update({name:nw}).eq('id',id);
  if(error)throw new Error(dupMsg(error));ALBUMROWS.find(a=>a.id===id).name=nw}
async function setAlbumCoverDB(name,mediaId){
  const row=ALBUMROWS.find(a=>a.name===name);
  if(!row)throw new Error('Album not found.');
  const {error}=await sb.from('albums').update({cover_media_id:mediaId}).eq('id',row.id);
  if(error)throw error;
  row.cover_media_id=mediaId}
async function backgroundMusicRecord(){
  const {data,error}=await sb.from('background_music').select('path,title,cover_path').eq('id',true).maybeSingle();
  if(error)throw error;
  return data}
async function loadBackgroundMusic(){
  const track=await backgroundMusicRecord();
  if(!track)return null;
  const paths=[track.path,...(track.cover_path?[track.cover_path]:[])];
  const {data,error}=await sb.storage.from('media').createSignedUrls(paths,86400);
  if(error)throw error;
  if(!data||!data[0]||!data[0].signedUrl)throw new Error('Could not create a playback URL for the shared song.');
  if(track.cover_path&&(!data[1]||!data[1].signedUrl))throw new Error('Could not load the shared cover photo.');
  return{...track,url:data[0].signedUrl,coverUrl:track.cover_path?data[1].signedUrl:''}}
async function uploadBackgroundMusic(file){
  const old=await backgroundMusicRecord();
  const path='background-music/'+uid()+'-'+file.name.replace(/[^\w.-]/g,'_');
  let last=-1;
  await uploadFile(path,file,p=>{const step=Math.floor(p/20);if(step!==last){last=step;toast('Uploading shared MP3 '+p+'%')}});
  const {error}=await sb.from('background_music').upsert({id:true,path,title:file.name.replace(/\.mp3$/i,''),cover_path:old&&old.cover_path||null},{onConflict:'id'});
  if(error){
    const {error:cleanupError}=await sb.storage.from('media').remove([path]);
    if(cleanupError)throw new Error(error.message+' The failed upload could not be cleaned up: '+cleanupError.message);
    throw error
  }
  if(old&&old.path!==path){
    const {error:cleanupError}=await sb.storage.from('media').remove([old.path]);
    if(cleanupError)toast('The new MP3 is saved, but the previous file could not be removed: '+cleanupError.message)
  }
  return{path,title:file.name.replace(/\.mp3$/i,'')}}
async function uploadBackgroundMusicCover(file){
  const old=await backgroundMusicRecord();
  if(!old)throw new Error('Upload the shared MP3 before adding its cover photo.');
  const path='background-music/covers/'+uid()+'-'+file.name.replace(/[^\w.-]/g,'_');
  await uploadFile(path,file);
  const {error}=await sb.from('background_music').update({cover_path:path}).eq('id',true);
  if(error){
    const {error:cleanupError}=await sb.storage.from('media').remove([path]);
    if(cleanupError)throw new Error(error.message+' The failed cover upload could not be cleaned up: '+cleanupError.message);
    throw error
  }
  if(old.cover_path){
    const {error:cleanupError}=await sb.storage.from('media').remove([old.cover_path]);
    if(cleanupError)toast('The new cover is saved, but the previous cover file could not be removed: '+cleanupError.message)
  }
  return path}
async function removeBackgroundMusic(){
  const old=await backgroundMusicRecord();
  if(!old)return;
  const {error}=await sb.from('background_music').delete().eq('id',true);
  if(error)throw error;
  const {error:storageError}=await sb.storage.from('media').remove([old.path,...(old.cover_path?[old.cover_path]:[])]);
  if(storageError)toast('The track was removed from the app, but its stored file could not be deleted: '+storageError.message)
}
async function downloadItem(it){
  const {data,error}=await sb.storage.from('media').createSignedUrl(it.path||PATHS[it.id],120,{download:true});
  if(error)return toast(error.message);location.href=data.signedUrl}
function exportList(){
  const f=i=>({title:i.t,date:i.d,album:i.a,uploader:i.u,favorite:!!i.fav,file:i.path||PATHS[i.id],deleted:!!i.del});
  const b=new Blob([JSON.stringify({albums:ALBUMS,items:[...items,...trash].map(f)},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download='gef-jini-list-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
