import {CLOUD_URL,PUBLISHABLE_KEY,REDIRECT_URL,AUTH_STORAGE_KEY} from './cloud-settings.mjs';
const status=document.querySelector('#auth-status');
const panel=document.querySelector('#editor-panel');
const login=document.querySelector('#google-login');
const logout=document.querySelector('#google-logout');
export const client=window.supabase.createClient(CLOUD_URL,PUBLISHABLE_KEY,{
  auth:{flowType:'pkce',storageKey:AUTH_STORAGE_KEY,detectSessionInUrl:true}
});
let started=false,checking=false;
async function check() {
  if(checking)return;checking=true;panel.hidden=true;login.hidden=false;
  try {
    const {data:{user},error}=await client.auth.getUser();
    if(error||!user){status.textContent='Entre com sua conta Google para acessar o editor.';logout.hidden=true;return;}
    logout.hidden=false;login.hidden=true;
    const {data:approved,error:denied}=await client.rpc('is_configuration_admin');
    if(denied)throw denied;
    if(!approved){
      status.textContent='Acesso negado: esta conta ainda não tem autorização administrativa. Seu UID: '+user.id;
      return;
    }
    status.textContent='Administrador autenticado.';
    if(!started){
      const {startEditor}=await import('./editor.js');
      await startEditor(client,user.id);
      await import('./audio-editor.js');
      started=true;
    }
    panel.hidden=false;
  } catch(error){status.textContent='Erro de autenticação: '+error.message;}
  finally{checking=false;}
}
login.addEventListener('click',async()=>{
  status.textContent='Abrindo login Google…';
  const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:REDIRECT_URL,queryParams:{prompt:'select_account'}}});
  if(error)status.textContent='Não foi possível entrar: '+error.message;
});
logout.addEventListener('click',async()=>{
  const {error}=await client.auth.signOut();
  if(error){status.textContent=error.message;return;}
  location.replace('./editor.html');
});
client.auth.onAuthStateChange(event=>{
  if(event==='SIGNED_OUT'){panel.hidden=true;login.hidden=false;logout.hidden=true;status.textContent='Sessão encerrada. Os rascunhos locais foram preservados.';}
  // Avoid awaiting Auth APIs inside the SDK's authentication lock.
  else if(event==='SIGNED_IN'&&!started)setTimeout(check,0);
});
check();
