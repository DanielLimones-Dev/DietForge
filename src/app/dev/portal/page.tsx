import {notFound} from 'next/navigation';
import {PortalPreview} from './preview';

export default async function PortalPreviewPage({searchParams}:{searchParams:Promise<{coach?:string;dark?:string}>}){
 if(process.env.NODE_ENV!=='development')notFound();
 const query=await searchParams;
 return <PortalPreview coach={query.coach==='1'} initialDark={query.dark==='1'}/>;
}
