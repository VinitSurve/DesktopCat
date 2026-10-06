import type { PetState } from '../types';

export interface AssistantReaction {
  stateSequence: PetState[];
  message: string;
  icon?: string;
  durationMs: number;
}

export class AssistantReactionSystem {
  static getReactionForReminder(title: string, catState: PetState): AssistantReaction {
    const t = title.toLowerCase();
    
    // Fallback default
    let reaction: AssistantReaction = {
      stateSequence: ['THINKING', 'REMINDING'],
      message: 'Reminder!',
      icon: '🔔',
      durationMs: 5000,
    };

    if (t.includes('water') || t.includes('drink') || t.includes('hydration')) {
      reaction = {
        stateSequence: ['THINKING', 'REMINDING'],
        message: 'Hydrate, human.',
        icon: '💧',
        durationMs: 5000,
      };
    } else if (t.includes('break')) {
      reaction = {
        stateSequence: ['STRETCHING', 'REMINDING'],
        message: 'Time for a little break?',
        icon: '☕',
        durationMs: 5000,
      };
    } else if (t.includes('stretch')) {
      reaction = {
        stateSequence: ['STRETCHING', 'REMINDING'],
        message: 'Stretch?',
        icon: '🧘',
        durationMs: 4000,
      };
    } else if (t.includes('study') || t.includes('focus')) {
      reaction = {
        stateSequence: ['THINKING', 'REMINDING'],
        message: 'Come on, we have work to do.',
        icon: '📚',
        durationMs: 4000,
      };
    } else if (t.includes('sleep') || t.includes('bed')) {
      reaction = {
        stateSequence: ['YAWNING', 'REMINDING'],
        message: 'Even cats need their beauty sleep.',
        icon: '🌙',
        durationMs: 4000,
      };
    } else {
      reaction = {
        stateSequence: ['THINKING', 'REMINDING'],
        message: `Don't forget: ${title}`,
        icon: '🔔',
        durationMs: 4000,
      };
    }

    // State context adjustments (respect current state)
    if (catState === 'SLEEPING') {
      reaction.stateSequence = ['YAWNING', ...reaction.stateSequence];
      reaction.durationMs += 3000;
    } else if (catState === 'WALKING') {
      reaction.stateSequence = ['LOOKING', ...reaction.stateSequence];
      reaction.durationMs += 2000;
    } else if (catState === 'SITTING') {
      reaction.stateSequence = ['CURIOUS', ...reaction.stateSequence];
      reaction.durationMs += 2000;
    } else if (catState === 'STRETCHING') {
      // Let it finish stretching naturally
      reaction.stateSequence = ['STRETCHING', ...reaction.stateSequence];
      reaction.durationMs += 2000;
    }
    
    return reaction;
  }

  static getReactionForTimer(title: string, catState: PetState): AssistantReaction {
    const t = title.toLowerCase();
    let reaction: AssistantReaction;

    if (t.includes('pomodoro') || t.includes('focus') || t.includes('study')) {
      reaction = {
        stateSequence: ['HAPPY', 'EXCITED'],
        message: 'Focus session finished!',
        icon: '🎉',
        durationMs: 6000,
      };
    } else {
      reaction = {
        stateSequence: ['LOOKING', 'HAPPY'],
        message: 'Timer done!',
        icon: '⏱️',
        durationMs: 5000,
      };
    }

    if (catState === 'SLEEPING') {
      reaction.stateSequence = ['YAWNING', ...reaction.stateSequence];
      reaction.durationMs += 3000;
    }

    return reaction;
  }
}
