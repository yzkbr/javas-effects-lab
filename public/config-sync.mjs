import {CLOUD_URL, PUBLISHABLE_KEY} from './cloud-settings.mjs';
import * as storage from './config-store.mjs';
const FIELDS = 'config_key,config_value,version,updated_at';
const allowed = key => ['site', 'audio_catalog'].includes(key);
export async function fetchPublic(key) {
  if (!allowed(key)) throw new Error('Configuração não pública.');
  const query = new URLSearchParams({select:FIELDS,config_key:`eq.${key}`,is_public:'eq.true'});
  const response = await fetch(`${CLOUD_URL}/rest/v1/app_configurations?${query}`, {
    headers:{apikey:PUBLISHABLE_KEY},cache:'no-store',signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`Sincronização indisponível (${response.status}).`);
  const rows = await response.json();
  if (rows.length !== 1) throw new Error('Configuração pública não encontrada.');
  return rows[0];
}
export async function latestPublic(key) {
  const remote = await fetchPublic(key);
  await storage.mutate('public:'+key, old => !old || remote.version >= old.version ? remote : old);
  return remote;
}
export function watchPublic(key, onChange) {
  let stopped = false, running = false;
  const refresh = async () => {
    if (stopped || running || !navigator.onLine || document.hidden) return;
    running = true;
    try {
      const old = await storage.read('public:'+key);
      const remote = await latestPublic(key);
      if (!stopped && (!old || remote.version > old.version)) onChange(remote);
    } catch (error) { console.info('Configurações locais mantidas:', error.message); }
    finally { running = false; }
  };
  refresh();
  const timer = setInterval(refresh, 30000);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => {stopped=true;clearInterval(timer);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
}
// Dependencies are injectable so offline/concurrent edits can be tested without live accounts.
export class ConfigurationSync {
  constructor(uid, client, store = storage, fetchLatest = fetchPublic) {
    this.uid=uid;this.client=client;this.store=store;this.fetchLatest=fetchLatest;
  }
  key(name) { if(!allowed(name))throw Error('Configuração não pública.');return `draft:${this.uid}:${name}`; }
  draft(name) {return this.store.read(this.key(name));}
  async stage(name, value, baseVersion) {
    return this.store.mutate(this.key(name), old => ({
      value:structuredClone(value),baseVersion:old?.baseVersion ?? baseVersion,
      revision:(old?.revision||0)+1,queued:old?.queued||false
    }));
  }
  async queue(name) {return this.store.mutate(this.key(name),old=>old?{...old,queued:true}:undefined);}
  async flush(name) {
    const run = async () => {
      const pending = await this.draft(name);
      if(!pending?.queued)return {status:'clean'};
      const remote = await this.fetchLatest(name);
      if(remote.version !== pending.baseVersion)return {status:'conflict',remote};
      const {data,error} = await this.client.from('app_configurations')
        .update({config_value:pending.value,is_public:true})
        .eq('config_key',name).eq('version',pending.baseVersion).select(FIELDS);
      if(error)throw error;
      if(data?.length!==1)return {status:'conflict',remote:await this.fetchLatest(name)};
      const saved=data[0];
      await this.store.write('public:'+name,saved);
      await this.store.mutate(this.key(name),current=>{
        if(!current || current.revision===pending.revision)return undefined;
        return {...current,baseVersion:saved.version};
      });
      return {status:'saved',record:saved,pending:!!(await this.draft(name))};
    };
    return globalThis.navigator?.locks ? navigator.locks.request('jel-config-'+this.uid+'-'+name,run) : run();
  }
}
