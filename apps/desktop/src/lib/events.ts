import { listen } from '@tauri-apps/api/event';
import { KyvonEvent } from '../types';

export const listenKyvonEvent = async (callback: (event: KyvonEvent) => void) => {
  return await listen<KyvonEvent>('kyvon-event', (e) => {
    callback(e.payload);
  });
};