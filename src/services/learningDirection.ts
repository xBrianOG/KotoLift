import { getLearningSettings, type LearningMode, type NativeLanguage } from './settings';
import type { Card } from '../types';

let sessionSeed = Math.random();

function seededRandom(): number {
  sessionSeed = (sessionSeed * 9301 + 49297) % 233280;
  return sessionSeed / 233280;
}

export interface FrontBack {
  front: string;
  back: string;
  frontLang?: string;
  backLang?: string;
  jaContent?: string;
  enContent?: string;
  esContent?: string;
  sourceLang?: string;
}

export function getFrontBack(card: Card, settings?: { nativeLang?: NativeLanguage; learningMode?: LearningMode }): FrontBack {
  const { learningMode: userMode } = settings || getLearningSettings();
  const learningMode = userMode || 'mixed';
  
  const sourceLang = card.sourceLang || 'en';
  
  const jaContent = card.jaText || card.translations?.ja || '';
  const enContent = card.enText || card.translations?.en || '';
  const esContent = card.esText || card.translations?.es || '';
  
  let sourceText = '';
  if (sourceLang === 'ja') {
    sourceText = card.sourceText || jaContent;
  } else if (sourceLang === 'en') {
    sourceText = card.sourceText || enContent;
  } else if (sourceLang === 'es') {
    sourceText = card.sourceText || esContent;
  }
  
  let mode = learningMode;
  
  if (mode === 'mixed') {
    mode = seededRandom() > 0.5 ? 'passive' : 'active';
  }
  
  if (mode === 'passive') {
    const backLines: string[] = [];
    const backLangs: string[] = [];
    
    if (sourceLang !== 'ja' && jaContent) {
      backLines.push(jaContent);
      backLangs.push('ja');
    }
    
    if (sourceLang !== 'en' && enContent) {
      backLines.push(enContent);
      backLangs.push('en');
    }
    
    if (sourceLang !== 'es' && esContent) {
      backLines.push(esContent);
      backLangs.push('es');
    }
    
    const firstBackLang = backLangs[0];
    const firstBackText = backLines[0];
    
    return {
      front: sourceText || '(no text)',
      back: backLines.join('\n\n') || '(no translations)',
      frontLang: sourceLang,
      backLang: firstBackLang,
      jaContent,
      enContent,
      esContent,
      sourceLang,
    };
  } else {
    let front = '';
    let frontLang = '';
    if (sourceLang === 'ja') {
      front = enContent || esContent || jaContent || '(no text)';
      frontLang = enContent ? 'en' : esContent ? 'es' : 'ja';
    } else if (sourceLang === 'en') {
      front = jaContent || esContent || enContent || '(no text)';
      frontLang = jaContent ? 'ja' : esContent ? 'es' : 'en';
    } else if (sourceLang === 'es') {
      front = jaContent || enContent || esContent || '(no text)';
      frontLang = jaContent ? 'ja' : enContent ? 'en' : 'es';
    }
    
    let back = sourceText || '(no text)';
    const backLines: string[] = [sourceText];
    
    if (sourceLang !== 'ja' && jaContent && jaContent !== sourceText) {
      backLines.push(jaContent);
    }
    if (sourceLang !== 'en' && enContent && enContent !== sourceText) {
      backLines.push(enContent);
    }
    if (sourceLang !== 'es' && esContent && esContent !== sourceText) {
      backLines.push(esContent);
    }
    
    back = backLines.filter(Boolean).join('\n\n') || '(no text)';
    
    return {
      front,
      back,
      frontLang,
      backLang: sourceLang,
      jaContent,
      enContent,
      esContent,
      sourceLang,
    };
  }
}