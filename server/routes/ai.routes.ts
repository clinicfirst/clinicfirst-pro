import { Router, Request, Response } from 'express';
import { voiceEngine } from '../voice/voice-engine';
import { db } from '../db';

export const aiRouter = Router();

// Start Inbound Call
aiRouter.post('/call/start', async (req: Request, res: Response) => {
  try {
    const { clinicId, callerPhone } = req.body;
    if (!clinicId) {
      return res.status(400).json({ error: 'clinicId is required to initiate an AI Receptionist call.' });
    }

    const session = await voiceEngine.startCallSession(clinicId, callerPhone);
    return res.json(session);
  } catch (err: any) {
    console.error('Error starting AI call:', err);
    return res.status(500).json({ error: err.message || 'Failed to start AI Receptionist session.' });
  }
});

// Process Inbound Speech / Text Message
aiRouter.post('/call/message', async (req: Request, res: Response) => {
  try {
    const { clinicId, sessionId, callId, message, history, durationSeconds } = req.body;

    if (!clinicId || !sessionId || !callId || !message) {
      return res.status(400).json({ error: 'clinicId, sessionId, callId, and message are required.' });
    }

    const result = await voiceEngine.handleCallMessage(
      clinicId,
      sessionId,
      callId,
      message,
      history || [],
      Number(durationSeconds) || 0
    );

    return res.json(result);
  } catch (err: any) {
    console.error('Error handling AI call message:', err);
    return res.status(500).json({ error: err.message || 'Failed to process AI Receptionist turn.' });
  }
});

// End Call
aiRouter.post('/call/end', async (req: Request, res: Response) => {
  try {
    const { clinicId, callId, durationSeconds, summary } = req.body;
    if (!clinicId || !callId) {
      return res.status(400).json({ error: 'clinicId and callId are required.' });
    }

    await voiceEngine.finishCall(clinicId, callId, Number(durationSeconds) || 0, summary);
    return res.json({ success: true, message: 'Call record finalized.' });
  } catch (err: any) {
    console.error('Error finalizing call:', err);
    return res.status(500).json({ error: err.message || 'Failed to finalize call.' });
  }
});

// Get Call Details
aiRouter.get('/call/:callId', (req: Request, res: Response) => {
  const { callId } = req.params;
  const clinicId = req.query.clinicId as string;

  if (!clinicId) {
    return res.status(400).json({ error: 'clinicId query param is required.' });
  }

  const call = db.getCalls(clinicId).find((c) => c.id === callId);
  if (!call) {
    return res.status(404).json({ error: 'Call not found.' });
  }

  return res.json({ call });
});
