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
}

export function getFrontBack(card: Card, settings?: { nativeLang?: NativeLanguage; learningMode?: LearningMode }): FrontBack {
  const { learningMode: userMode } = settings || getLearningSettings();
  const learningMode = userMode || 'mixed';
  
  const sourceLang = card.sourceLang || 'ja';
  
  // Get source text based on sourceLang
  let sourceText = '';
  if (card.sourceText) {
    sourceText = card.sourceText;
  } else if (sourceLang === 'ja') {
    sourceText = card.jaText || '';
  } else if (sourceLang === 'en') {
    sourceText = card.enText || '';
  } else if (sourceLang === 'es') {
    sourceText = card.esText || '';
  }
  
  // Get all translations - ONLY from translations object (not legacy fields which contain source)
  const enText = card.translations?.en || '';
  const esText = card.translations?.es || '';
  const jaText = card.translations?.ja || '';
  
  let mode = learningMode;
  
  // For mixed mode, pick randomly but consistently within session
  if (mode === 'mixed') {
    mode = seededRandom() > 0.5 ? 'passive' : 'active';
  }
  
  if (mode === 'passive') {
    // Source → Native: show translations on back (no labels)
    const backLines: string[] = [];
    
    // Add Japanese translation (unless source is Japanese)
    if (sourceLang !== 'ja' && jaText) {
      backLines.push(jaText);
    } else if (sourceLang !== 'ja') {
      backLines.push('(translation missing)');
    }
    
    // Add English translation (unless source is English)
    if (sourceLang !== 'en' && enText) {
      backLines.push(enText);
    } else if (sourceLang !== 'en') {
      backLines.push('(translation missing)');
    }
    
    // Add Spanish translation (unless source is Spanish)
    if (sourceLang !== 'es' && esText) {
      backLines.push(esText);
    }
    
    return {
      front: sourceText || '(no text)',
      back: backLines.join('\n\n')
    };
  } else {
    // Active: Native → Source
    // Show Japanese on front (since user is Japanese learner), source on back
    const front = jaText || sourceText || '(no text)';
    const back = sourceText || '(no text)';
    
    // Add other translations on back too (without labels)
    let backWithTranslations = back;
    if (sourceLang !== 'ja' && enText) {
      backWithTranslations += `\n\n${enText}`;
    }
    if (sourceLang !== 'ja' && esText) {
      backWithTranslations += `\n\n${esText}`;
    }
    
    return {
      front,
      back: backWithTranslations
    };
  }
}
