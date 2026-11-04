import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {montarDpsPreviaSba} from './dpsXmlSba.service';
import {validarTesteProducaoSba} from './sefinTransmissaoSba.service';
/** Adaptação explícita ao XSD de produção 1.01/20260209. */
export function montarDpsProducaoSba(nota:any,agora=new Date()){
 validarTesteProducaoSba(nota);
 const previa=montarDpsPreviaSba(nota,agora);
 if(!previa.xml)return {...previa,somenteHomologacao:false};
 const NS='http://www.sped.fazenda.gov.br/nfse';
 const doc=new DOMParser().parseFromString(previa.xml,'application/xml');
 const inf=doc.getElementsByTagNameNS(NS,'infDPS')[0];
 doc.getElementsByTagNameNS(NS,'tpAmb')[0].textContent='1';
 const fin=doc.getElementsByTagNameNS(NS,'finNFSe')[0];if(fin)inf.removeChild(fin);
 const serv=doc.getElementsByTagNameNS(NS,'cServ')[0];
 const nbs=doc.getElementsByTagNameNS(NS,'cNBS')[0];
 if(nbs){serv.removeChild(nbs);serv.appendChild(nbs);}
 const ibs=doc.getElementsByTagNameNS(NS,'IBSCBS')[0];
 if(ibs){const trib=ibs.getElementsByTagNameNS(NS,'trib')[0];const grupo=doc.createElementNS(NS,'gIBSCBS');while(trib.firstChild)grupo.appendChild(trib.firstChild);trib.appendChild(grupo);const finProd=doc.createElementNS(NS,'finNFSe');finProd.textContent='0';ibs.insertBefore(finProd,ibs.firstChild);}
 return {...previa,xml:new XMLSerializer().serializeToString(doc),somenteHomologacao:false};
}
