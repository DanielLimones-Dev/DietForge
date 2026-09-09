'use client';
import {useEffect} from 'react';
import {recordError} from '@/lib/error-monitor';
export function ErrorMonitor(){useEffect(()=>{const error=()=>recordError('runtime');const rejection=()=>recordError('promise');window.addEventListener('error',error);window.addEventListener('unhandledrejection',rejection);return()=>{window.removeEventListener('error',error);window.removeEventListener('unhandledrejection',rejection);};},[]);return null;}
