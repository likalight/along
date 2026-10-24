import {cpSync,mkdirSync} from 'node:fs';
const root=new URL('../dist/catalog/',import.meta.url);
mkdirSync(root,{recursive:true});
cpSync(new URL('../../catalog/sources/',import.meta.url),new URL('sources/',root),{recursive:true});
