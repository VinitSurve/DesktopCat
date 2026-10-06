/**
 * PetView — The main pet view that orchestrates the behavior engine,
 * movement engine, canvas renderer, and user interactions.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, PhysicalPosition, LogicalSize, currentMonitor } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { PetCanvas } from './components/PetCanvas';
import { PetMenu } from './components/PetMenu';
import { AIAssistantMenu } from './ai-ui/AIAssistantMenu';
import { AIService } from './ai/AIService';
import { ClipboardService } from './clipboard/ClipboardService';
import { BehaviorEngine } from './pet/BehaviorEngine';
import { MovementEngine } from './pet/MovementEngine';
import { usePetStore } from './state/store';
import type { PetSettings, MonitorInfo, EnvironmentInfo } from './types';
import { PET_SIZES } from './types';
import { globalScheduler } from './reminders/ReminderScheduler';
import { globalTimerManager } from './timers/TimerManager';
import { useReminderStore } from './reminders/ReminderStore';
import { useTimerStore } from './timers/TimerStore';
import { AssistantEventBus } from './assistant/AssistantEventBus';
import { AssistantReactionSystem } from './assistant/AssistantReactionSystem';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { PetState } from './types';

export function PetView() {
  const {
    petState,
    direction,
    isDragging,
    isPaused,
    mood,
    environment,
    position,
    settings,
    menuOpen,
    menuPosition,
    settingsLoaded,
    setPetState,
    setDirection,
    setIsDragging,
    setIsPaused,
    setPosition,
    updateMood,
    tickMood,
    setSettings,
    setSettingsLoaded,
    setMenuOpen,
    setEnvironment,
  } = usePetStore();

  const behaviorRef = useRef(new BehaviorEngine('IDLE'));
  const movementRef = useRef(new MovementEngine(600, 400));
  const lastUpdateRef = useRef(performance.now());
  const positionSaveTimerRef = useRef<number | null>(null);
  const envTimerRef = useRef<number | null>(null);
  const prevSizeRef = useRef<number | null>(null);
  const [windowReady, setWindowReady] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);

  // ─── Load Settings & Position ────────────────────────────────────────

  useEffect(() => {
    const loadInitialState = async () => {
      try {
        const [savedSettings, savedPosition, monitorInfo] = await Promise.all([
          invoke<PetSettings>('get_settings'),
          invoke<{ x: number; y: number }>('get_position'),
          invoke<MonitorInfo | null>('get_monitor_info'),
        ]);

        setSettings(savedSettings);
        setPosition(savedPosition);
        movementRef.current.setPosition(savedPosition.x, savedPosition.y);
        movementRef.current.setSpeedMultiplier(savedSettings.speed);

        if (monitorInfo) {
          movementRef.current.updateMonitorInfo(monitorInfo);
        }

        const sizeConfig = PET_SIZES[savedSettings.size];
        movementRef.current.setPetSize(sizeConfig.window);

        // Enforce always-on-top dynamically via native macOS bridge to preserve NSStatusWindowLevel
        await invoke('apply_pet_window_level', { alwaysOnTop: savedSettings.always_on_top }).catch(() => {});

        setSettingsLoaded(true);
        setWindowReady(true);
        
        // Start Assistant Modules
        await useReminderStore.getState().loadReminders();
        await useTimerStore.getState().loadTimers();
        globalScheduler.start();
        globalTimerManager.start();

      } catch (err) {
        console.error('Failed to load initial state:', err);
        setSettingsLoaded(true);
        setWindowReady(true);
      }
    };

    loadInitialState();

    // Cleanup
    return () => {
      globalScheduler.stop();
      globalTimerManager.stop();
    };
  }, []);

  // ─── Listen for Assistant Events ─────────────────────────────────────────
  
  useEffect(() => {
    let reactionTimeout: number | null = null;
    let sequenceTimeouts: number[] = [];
    
    const showBubble = async (data: any) => {
      let win = await WebviewWindow.getByLabel('reminder_bubble');
      
      const pos = await getCurrentWindow().outerPosition();
      const monitor = await currentMonitor();
      
      let x = pos.x + 240; // Right of the cat by default
      const y = pos.y;
      
      // If we're near the right edge of the screen, show it on the left
      if (monitor && (x + 260) > monitor.size.width) {
        x = pos.x - 260; // Left of the cat
      }
      
      if (!win) {
        win = new WebviewWindow('reminder_bubble', {
          url: '/?windowLabel=reminder_bubble',
          title: 'PixelPaw Reminder',
          width: 260,
          height: 140,
          x: x,
          y: y,
          transparent: true,
          decorations: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          resizable: false,
        });
      } else {
        win.setPosition({ type: 'Physical', x, y } as any);
        win.show();
      }

      // We need to wait for the window to be ready to receive events
      let unlistenReady: (() => void) | null = null;
      listen('bubble_ready', () => {
        emit('set_bubble_data', data);
        if (unlistenReady) unlistenReady();
      }).then(f => unlistenReady = f);
      
      // Also emit immediately in case it's already open
      setTimeout(() => emit('set_bubble_data', data), 500);
    };

    const runReactionSequence = (seq: PetState[], totalDurationMs: number) => {
      if (seq.length === 0) return;
      
      // Temporarily override state
      behaviorRef.current.forceState(seq[0]);
      setPetState(seq[0]);
      
      if (seq.length > 1) {
        // Just split duration evenly for simplicity
        const stepMs = totalDurationMs / seq.length;
        for (let i = 1; i < seq.length; i++) {
          const t = window.setTimeout(() => {
            behaviorRef.current.forceState(seq[i]);
            setPetState(seq[i]);
          }, stepMs * i);
          sequenceTimeouts.push(t);
        }
      }
    };

    const unsub = AssistantEventBus.subscribe((event) => {
      let reaction = null;
      let bubbleData = null;
      const catState = behaviorRef.current.state;

      if (event.type === 'REMINDER_TRIGGERED') {
        reaction = AssistantReactionSystem.getReactionForReminder(event.payload.title, catState);
        bubbleData = { 
          id: event.payload.id, 
          title: event.payload.title,
          message: reaction.message, 
          icon: reaction.icon,
          type: 'REMINDER' 
        };
      } else if (event.type === 'TIMER_COMPLETED') {
        reaction = AssistantReactionSystem.getReactionForTimer(event.payload.title, catState);
        bubbleData = { 
          id: event.payload.id, 
          title: event.payload.title,
          message: reaction.message, 
          icon: reaction.icon,
          type: 'TIMER' 
        };
      }

      if (reaction && bubbleData) {
        // Clear previous reaction
        if (reactionTimeout) clearTimeout(reactionTimeout);
        sequenceTimeouts.forEach(clearTimeout);
        sequenceTimeouts = [];
        
        behaviorRef.current.setLocked(true);
        
        runReactionSequence(reaction.stateSequence, reaction.durationMs);
        
        // Show bubble mid-sequence
        const bubbleDelay = reaction.stateSequence.length > 1 ? (reaction.durationMs / reaction.stateSequence.length) : 500;
        setTimeout(() => showBubble(bubbleData), bubbleDelay);
      } else {
        // Fallback for other events
        const newState = behaviorRef.current.reactToEvent(event.type);
        if (newState) {
          setPetState(newState);
        }
      }
    });

    const actionListener = listen<{action: string, id: string, type: string, minutes?: number}>('bubble_action', async (e) => {
      const win = await WebviewWindow.getByLabel('reminder_bubble');
      if (win) win.hide();
      
      const { action, id, type, minutes } = e.payload;
      
      if (type === 'REMINDER') {
        if (action === 'DONE' || action === 'DISMISS') {
          // It's already handled by the scheduler for 'completed', but we could mark it
          useReminderStore.getState().updateReminder(id, { completed: true });
        } else if (action === 'SNOOZE' && minutes) {
          useReminderStore.getState().updateReminder(id, { 
            nextTriggerAt: Date.now() + minutes * 60 * 1000 
          });
        }
      }
      
      // Satisfied animation
      if (type === 'REMINDER' && action === 'DONE') {
        behaviorRef.current.forceState('HAPPY');
        setPetState('HAPPY');
        setTimeout(() => {
          behaviorRef.current.forceState('IDLE');
          setPetState('IDLE');
          behaviorRef.current.setLocked(false);
        }, 3000);
      } else {
        behaviorRef.current.forceState('IDLE');
        setPetState('IDLE');
        behaviorRef.current.setLocked(false);
      }
    });

    return () => {
      unsub();
      actionListener.then(f => f());
      if (reactionTimeout) clearTimeout(reactionTimeout);
      sequenceTimeouts.forEach(clearTimeout);
    };
  }, [setPetState]);

  // ─── Listen for Pause Toggle from Tray ───────────────────────────────

  useEffect(() => {
    const unlisten = listen<boolean>('pet-pause-toggle', (event) => {
      setIsPaused(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setIsPaused]);

  // ─── Main Update Loop ───────────────────────────────────────────────

  useEffect(() => {
    if (!windowReady) return;

    let animFrameId: number;

    const update = () => {
      const now = performance.now();
      const deltaTime = now - lastUpdateRef.current;
      lastUpdateRef.current = now;

      if (!isPaused && !isDragging) {
        // Update behavior engine
        const stateChanged = behaviorRef.current.update(mood, environment, position, settings);
        if (stateChanged) {
          const newState = behaviorRef.current.state;
          setPetState(newState);
        }

        // Update movement
        if (settings.random_movement) {
          movementRef.current.update(petState, deltaTime);
          const pos = movementRef.current.position;
          const dir = movementRef.current.direction;

          setPosition(pos);
          setDirection(dir);

          // Move the Tauri window
          getCurrentWindow()
            .setPosition(new PhysicalPosition(Math.round(pos.x), Math.round(pos.y)))
            .catch(() => {});

          // Stop walking animation naturally when target is reached
          if (petState === 'WALKING' && movementRef.current.hasArrived) {
            behaviorRef.current.forceState('IDLE');
            setPetState('IDLE');
          }
        }

        // Tick mood periodically (roughly every 2 seconds via frame count)
        if (Math.random() < 0.008) {
          tickMood();
        }
      }

      // Schedule position save (debounced)
      if (positionSaveTimerRef.current === null) {
        positionSaveTimerRef.current = window.setTimeout(() => {
          const pos = movementRef.current.position;
          invoke('update_position', { position: pos }).catch(() => {});
          positionSaveTimerRef.current = null;
        }, 5000);
      }

      animFrameId = requestAnimationFrame(update);
    };

    animFrameId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animFrameId);
      if (positionSaveTimerRef.current !== null) {
        clearTimeout(positionSaveTimerRef.current);
      }
    };
  }, [windowReady, isPaused, isDragging, petState, mood, environment, position, settings.random_movement]);

  // ─── Sync Settings Changes ────────────────────────────────────────────

  useEffect(() => {
    if (!settingsLoaded) return;
    
    movementRef.current.setSpeedMultiplier(settings.speed);
    const sizeConfig = PET_SIZES[settings.size];
    const newSize = sizeConfig.window;
    
    movementRef.current.setPetSize(newSize);

    if (prevSizeRef.current !== null && prevSizeRef.current !== newSize) {
      const delta = newSize - prevSizeRef.current;
      const scaleFactor = movementRef.current.currentScaleFactor;
      const physicalShift = (delta / 2) * scaleFactor;
      
      const currentPos = movementRef.current.position;
      const newX = currentPos.x - physicalShift;
      const newY = currentPos.y - physicalShift;
      
      movementRef.current.setPosition(newX, newY);
      setPosition({ x: newX, y: newY });
      
      getCurrentWindow()
        .setPosition(new PhysicalPosition(Math.round(newX), Math.round(newY)))
        .catch(() => {});
    }
    
    prevSizeRef.current = newSize;

    // Resize window when size changes
    const appWindow = getCurrentWindow();
    appWindow.setSize(new LogicalSize(newSize, newSize)).catch(() => {});
  }, [settings.size, settings.speed, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    invoke('apply_pet_window_level', { alwaysOnTop: settings.always_on_top }).catch(() => {});
  }, [settings.always_on_top, settingsLoaded]);

  // ─── Environment Polling ──────────────────────────────────────────────

  useEffect(() => {
    if (!windowReady) return;

    envTimerRef.current = window.setInterval(async () => {
      try {
        const env = await invoke<EnvironmentInfo | null>('get_environment_info');
        setEnvironment(env);
      } catch (err) {
        // ignore
      }
    }, 1000); // Polling every 1 second is enough to be responsive without spamming CPU

    return () => {
      if (envTimerRef.current !== null) {
        clearInterval(envTimerRef.current);
      }
    };
  }, [windowReady, setEnvironment]);

  // ─── Interaction Handlers ─────────────────────────────────────────────

  const handlePetClick = useCallback(() => {
    behaviorRef.current.reactToEvent('PET_CLICK');
    setPetState(behaviorRef.current.state);
    updateMood({ happiness: mood.happiness + 3, curiosity: mood.curiosity + 2 });
  }, [setPetState, updateMood, mood]);

  const handlePetDoubleClick = useCallback(() => {
    behaviorRef.current.reactToEvent('PET_DOUBLE_CLICK');
    setPetState(behaviorRef.current.state);
    updateMood({ happiness: mood.happiness + 8, energy: mood.energy + 5 });
  }, [setPetState, updateMood, mood]);

  const handlePetRightClick = useCallback(
    (x: number, y: number) => {
      setMenuOpen(true, { x, y });
    },
    [setMenuOpen]
  );

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    behaviorRef.current.forceState('DRAGGED');
    setPetState('DRAGGED');
  }, [setIsDragging, setPetState]);

  const handleDragEnd = useCallback(async () => {
    setIsDragging(false);
    behaviorRef.current.reactToEvent('PET_DRAG_END');
    setPetState(behaviorRef.current.state);

    // Update position after drag
    try {
      const pos = await getCurrentWindow().outerPosition();
      movementRef.current.setPosition(pos.x, pos.y);
      setPosition({ x: pos.x, y: pos.y });
      invoke('update_position', { position: { x: pos.x, y: pos.y } }).catch(() => {});
      
      // Update monitor info in case we were dragged to a different monitor
      const newMonitor = await invoke<MonitorInfo | null>('get_monitor_info');
      if (newMonitor) {
        movementRef.current.updateMonitorInfo(newMonitor);
      }
    } catch {
      // Position update failed, not critical
    }
  }, [setIsDragging, setPetState, setPosition]);

  const handleHoverEnter = useCallback(() => {
    behaviorRef.current.reactToEvent('PET_HOVER_ENTER');
    setPetState(behaviorRef.current.state);
  }, [setPetState]);

  const handleHoverExit = useCallback(() => {
    behaviorRef.current.reactToEvent('PET_HOVER_EXIT');
    setPetState(behaviorRef.current.state);
  }, [setPetState]);

  const handleMenuAction = useCallback(
    (action: string) => {
      switch (action) {
        case 'ai_assistant':
          setAiMenuOpen(true);
          break;
        case 'ocr_screen':
          invoke('open_ocr_selection_window').catch(() => {});
          break;
        case 'settings':
          invoke('open_settings_window').catch(() => {});
          break;
        case 'add_reminder':
          invoke('open_settings_window').catch(() => {});
          setTimeout(() => emit('open_settings_tab', 'reminders'), 500);
          break;
        case 'timers':
          invoke('open_settings_window').catch(() => {});
          setTimeout(() => emit('open_settings_tab', 'timers'), 500);
          break;
        case 'pause':
          setIsPaused(!isPaused);
          invoke('set_pet_paused', { paused: !isPaused }).catch(() => {});
          break;
        case 'sleep':
          behaviorRef.current.forceState('SLEEPING');
          setPetState('SLEEPING');
          updateMood({ sleepiness: 0, energy: mood.energy + 20 });
          break;
        case 'wake':
          behaviorRef.current.forceState('IDLE');
          setPetState('IDLE');
          updateMood({ sleepiness: 0 });
          break;
        case 'wave':
          behaviorRef.current.forceState('WAVING');
          setPetState('WAVING');
          updateMood({ happiness: mood.happiness + 5 });
          break;
        case 'quit':
          const pos = movementRef.current.position;
          invoke('update_position', { position: pos }).catch(() => {});
          invoke('update_settings', { settings }).catch(() => {});
          // Small delay to let saves complete
          setTimeout(() => {
            invoke('quit_app').catch(() => {});
          }, 100);
          break;
      }
    },
    [isPaused, mood, settings, setIsPaused, setPetState, updateMood]
  );

  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
  }, [setMenuOpen]);

  const handleMouseEnter = useCallback(() => {
    behaviorRef.current.reactToEvent('MOUSE_NEAR');
    setPetState(behaviorRef.current.state);
  }, [setPetState]);

  const handleMouseLeave = useCallback(() => {
    behaviorRef.current.reactToEvent('USER_IDLE');
    setPetState(behaviorRef.current.state);
  }, [setPetState]);

  const handleAiAction = useCallback(async (action: string) => {
    let stage = "START";

    try {
      stage = "CLIPBOARD_READ";
      const text = await ClipboardService.readText();
      
      if (!text || text.trim() === '') {
        behaviorRef.current.reactToEvent('AI_FAILED');
        setPetState(behaviorRef.current.state);
        return;
      }

      stage = "REQUEST_BUILD";
      const { gemini_model } = usePetStore.getState().settings;
      
      const testProvider = 'GEMINI'; 
      const resolvedModel = gemini_model;

      behaviorRef.current.reactToEvent('AI_STARTED');
      setPetState(behaviorRef.current.state);

      let systemPrompt = `You are an AI assistant processing clipboard text. Action requested: ${action}. Please perform the action directly without conversational filler. Return ONLY the result.`;

      switch (action) {
        case 'make_professional':
          systemPrompt = "You are a professional writing assistant. Rewrite the user's text professionally while preserving its original meaning. Return ONLY the rewritten text. Do not greet the user or explain what you changed.";
          break;
        case 'make_casual':
          systemPrompt = "You are a writing assistant. Rewrite the user's text in a friendly, casual, and relaxed tone while preserving its original meaning. Return ONLY the rewritten text. Do not greet the user or explain what you changed.";
          break;
        case 'fix_grammar':
          systemPrompt = "You are an expert proofreader. Fix all grammatical, spelling, and punctuation errors in the user's text. Make it flow naturally. Return ONLY the corrected text. Do not greet the user or explain what you changed.";
          break;
        case 'rewrite':
          systemPrompt = "You are a writing assistant. Rewrite the user's text to improve clarity and flow. Return ONLY the rewritten text. Do not greet the user or explain what you changed.";
          break;
        case 'summarize':
          systemPrompt = "You are a highly efficient summarization assistant. Summarize the user's text concisely. Return ONLY the summary. Do not greet the user or explain what you changed.";
          break;
        case 'shorten':
          systemPrompt = "You are an editor. Make the user's text significantly shorter and punchier without losing the core meaning. Return ONLY the shortened text. Do not greet the user or explain what you changed.";
          break;
        case 'explain':
          systemPrompt = "Explain the concepts in the user's text clearly and concisely. Do not greet the user.";
          break;
        case 'explain_code':
          systemPrompt = "You are an expert software engineer. Explain the user's code clearly and concisely. Do not greet the user.";
          break;
        case 'optimize_code':
          systemPrompt = "You are an expert software engineer. Refactor and optimize the user's code for performance and readability. Return ONLY the optimized code (preferably in markdown blocks). Do not greet the user or explain what you changed.";
          break;
      }

      const request = {
        prompt: text,
        systemPrompt,
        model: resolvedModel
      };

      stage = "AI_SERVICE";
      
      const res = await AIService.generate({ ...request, provider: testProvider } as any);



      stage = "RESULT_WINDOW";
      await invoke('open_ai_result_window');


      setTimeout(async () => {
        try {
           await emit('ai-result-data', {
             originalText: text,
             resultText: res.text,
             action,
             provider: res.provider,
           });
        } catch(e) {
           console.error(`[AI] Error emitting ai-result-data`, e);
        }
      }, 500);

      behaviorRef.current.reactToEvent('AI_COMPLETED');
      setPetState(behaviorRef.current.state);
    } catch (err: any) {
      const safeErrorString = err?.message || err?.toString() || "Unknown error";
      console.error(`[AI] Error generating response: ${safeErrorString}`);
      
      try {
        await invoke('open_ai_result_window');
      } catch (invokeErr: any) {
        console.error(`[AI] Error opening result window:`, invokeErr);
      }

      const { gemini_model } = usePetStore.getState().settings;
      setTimeout(async () => {
        try {
           await emit('ai-result-data', {
             error: `AI REQUEST FAILED\n\nStage: ${stage}\n\nReason:\n${safeErrorString}`,
             provider: 'GEMINI',
             model: gemini_model,
           });
        } catch(e) {
           console.error(`[AI] Error emitting ai-result-data in error path`, e);
        }
      }, 500);


      behaviorRef.current.reactToEvent('AI_FAILED');
      setPetState(behaviorRef.current.state);

    }
  }, [setPetState]);

  // ─── Render ────────────────────────────────────────────────────────────

  if (!windowReady) return null;

  return (
    <div className="pet-container">
      <PetCanvas
        petState={petState}
        direction={direction}
        isPaused={isPaused}
        onPetClick={handlePetClick}
        onPetDoubleClick={handlePetDoubleClick}
        onPetRightClick={handlePetRightClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPetHoverEnter={handleHoverEnter}
        onPetHoverExit={handleHoverExit}
      />

      {menuOpen && !aiMenuOpen && (
        <PetMenu
          x={menuPosition.x}
          y={menuPosition.y}
          onAction={handleMenuAction}
          onClose={handleMenuClose}
        />
      )}

      {aiMenuOpen && (
        <AIAssistantMenu
          x={menuPosition.x}
          y={menuPosition.y}
          onAction={handleAiAction}
          onClose={() => setAiMenuOpen(false)}
        />
      )}
    </div>
  );
}
