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
  
  const sourceLang = card.sourceLang || 'en';
  
  // Get all language texts - from explicit fields (new schema) or translations object (legacy)
  const jaContent = card.jaText || card.translations?.ja || '';
  const enContent = card.enText || card.translations?.en || '';
  const esContent = card.esText || card.translations?.es || '';
  
  // Get source text based on sourceLang
  let sourceText = '';
  if (sourceLang === 'ja') {
    sourceText = card.sourceText || jaContent;
  } else if (sourceLang === 'en') {
    sourceText = card.sourceText || enContent;
  } else if (sourceLang === 'es') {
    sourceText = card.sourceText || esContent;
  }
  
  let mode = learningMode;
  
  // For mixed mode, pick randomly but consistently within session
  if (mode === 'mixed') {
    mode = seededRandom() > 0.5 ? 'passive' : 'active';
  }
  
  if (mode === 'passive') {
    // Source → Native: show translations on back
    const backLines: string[] = [];
    
    // Add Japanese (unless source is Japanese)
    if (sourceLang !== 'ja' && jaContent) {
      backLines.push(jaContent);
    }
    
    // Add English (unless source is English)
    if (sourceLang !== 'en' && enContent) {
      backLines.push(enContent);
    }
    
    // Add Spanish (unless source is Spanish)
    if (sourceLang !== 'es' && esContent) {
      backLines.push(esContent);
    }
    
    return {
      front: sourceText || '(no text)',
      back: backLines.join('\n\n') || '(no translations)'
    };
  } else {
    // Active: Native → Source
    // Show translation on front, source on back
    
    // Determine front content based on sourceLang
    // Default: show the translation that's NOT the source language
    let front = '';
    if (sourceLang === 'ja') {
      // If source is Japanese, show English on front
      front = enContent || esContent || jaContent || '(no text)';
    } else if (sourceLang === 'en') {
      // If source is English, show Japanese on front
      front = jaContent || esContent || enContent || '(no text)';
    } else if (sourceLang === 'es') {
      // If source is Spanish, show Japanese or English on front
      front = jaContent || enContent || esContent || '(no text)';
    }
    
    // Build back with source text and other translations
    let back = sourceText || '(no text)';
    
    // Add other translations on back (only if different from source to avoid duplicates)
    if (sourceLang !== 'ja' && jaContent && jaContent !== sourceText) {
      back += `\n\n${jaContent}`;
    }
    if (sourceLang !== 'en' && enContent && enContent !== sourceText) {
      back += `\n\n${enContent}`;
    }
    if (sourceLang !== 'es' && esContent && esContent !== sourceText) {
      back += `\n\n${esContent}`;
    }
    
    return {
      front,
      back
    };
  }
}
