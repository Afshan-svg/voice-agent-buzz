export interface RealtimeSessionConfig {
  callSid: string;
  callId: string;
  callerNumber: string;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
}

export interface RealtimeServerEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

export interface SessionUpdateEvent extends RealtimeServerEvent {
  type: 'session.update';
  session: Record<string, unknown>;
}

export interface InputAudioBufferAppendEvent {
  type: 'input_audio_buffer.append';
  audio: string;
}

export interface ResponseCreateEvent {
  type: 'response.create';
  response?: {
    modalities?: string[];
    output_modalities?: string[];
    instructions?: string;
  };
}

export interface ResponseCancelEvent {
  type: 'response.cancel';
}

export interface ConversationItemCreateEvent {
  type: 'conversation.item.create';
  item:
    | {
        type: 'function_call_output';
        call_id: string;
        output: string;
      }
    | {
        type: 'message';
        role: 'system' | 'user' | 'assistant';
        content: Array<{
          type: 'input_text';
          text: string;
        }>;
      };
}

export type RealtimeClientEvent =
  | SessionUpdateEvent
  | InputAudioBufferAppendEvent
  | ResponseCreateEvent
  | ResponseCancelEvent
  | ConversationItemCreateEvent;

export interface FunctionCallArgumentsDoneEvent extends RealtimeServerEvent {
  type: 'response.function_call_arguments.done';
  call_id: string;
  name: string;
  arguments: string;
  response_id?: string;
}

export interface AudioDeltaEvent extends RealtimeServerEvent {
  type: 'response.audio.delta' | 'response.output_audio.delta';
  delta?: string;
  response_id?: string;
}

export interface SpeechStartedEvent extends RealtimeServerEvent {
  type: 'input_audio_buffer.speech_started';
}

export interface AudioTranscriptDoneEvent extends RealtimeServerEvent {
  type:
    | 'response.audio_transcript.done'
    | 'response.output_audio_transcript.done'
    | 'conversation.item.input_audio_transcription.completed';
  transcript?: string;
}

export interface RealtimeErrorEvent extends RealtimeServerEvent {
  type: 'error';
  error?: {
    type?: string;
    code?: string;
    message?: string;
  };
}
