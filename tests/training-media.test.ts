import {test} from 'node:test';
import assert from 'node:assert/strict';
import {youtubeUrl,mediaPath,exerciseVideo,videoFileError} from '../src/lib/training-media';
import {exerciseFromLibrary} from '../src/lib/training';
test('YouTube accepts individual videos and rejects unsafe or misleading hosts',()=>{
 assert.equal(youtubeUrl('https://youtu.be/C8rcH2DJxp0?t=1m3s'),'https://www.youtube.com/watch?v=C8rcH2DJxp0&t=63s');
 for(const v of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=C8rcH2DJxp0','https://youtube.com@evil.test/watch?v=C8rcH2DJxp0','https://youtube.com/playlist?list=123','http://youtu.be/C8rcH2DJxp0'])assert.equal(youtubeUrl(v),null);
});
test('legacy exercise videos are not assigned or displayed; coach explicitly opts in',()=>{
 const e=exerciseFromLibrary({id:'x',name:'Press',muscle_group:'Pecho',video_url:'https://youtu.be/C8rcH2DJxp0'},2);
 assert.equal(e.video_url,undefined);
 e.video_url='https://youtu.be/C8rcH2DJxp0';e.video_custom=false;assert.equal(exerciseVideo(e),'');
 e.video_custom=true;assert.equal(exerciseVideo(e),e.video_url);
});
test('private media paths and upload limits are validated',()=>{
 const path='10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001.mp4';
 assert.equal(mediaPath('storage:'+path),path);assert.equal(mediaPath('storage:../x.mp4'),null);
 assert.equal(videoFileError({type:'video/mp4',size:1024}),null);
 assert.ok(videoFileError({type:'text/html',size:1024}));assert.ok(videoFileError({type:'video/mp4',size:52428801}));
});
