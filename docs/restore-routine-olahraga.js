/**
 * Restore Routine "Olahraga" — Browser Console Script
 *
 * Paste ENTIRE block below into F12 → Console while on the notes-dump app page.
 *
 * This will:
 * 1. Check if a routine with "olahraga" in its content already exists
 * 2. If found, set it visible/highlight it
 * 3. If NOT found, create a new weekly routine for it
 *
 * === PASTE BELOW THIS LINE ===
 */
(async () => {
  'use strict';

  // Try to get app data from React internals or localStorage
  const raw = localStorage.getItem('braindump_chat_history');
  if (!raw) return console.error('❌ No braindump data found');

  const data = JSON.parse(raw);
  const items = data.items || [];

  // Look for existing olahraga routine
  const existing = items.find(i =>
    i.type === 'TODO' &&
    i.meta?.isRoutine &&
    i.content.toLowerCase().includes('olahraga')
  );

  if (existing) {
    console.log('✅ Found existing olahraga routine:', existing.content);
    console.log('   Status:', existing.status);
    console.log('   Next due:', existing.meta.date);
    console.log('   Reload the page to see it in Tasks tab.');
    
    // Make sure isRoutine flag is set
    if (!existing.meta.isRoutine) {
      existing.meta.isRoutine = true;
      existing.meta.tags = [...(existing.meta.tags || []), 'routine'];
      localStorage.setItem('braindump_chat_history', JSON.stringify(data));
      console.log('✅ Fixed missing isRoutine flag — reloading...');
      location.reload();
    } else {
      console.log('✅ Routine is properly configured. Reload to see it.');
      location.reload();
    }
    return;
  }

  // Create new routine: olahraga tiap minggu
  const now = new Date();
  // Calculate next Sunday at 7:00 AM
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(7, 0, 0, 0);

  const newItem = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'routine-' + Date.now() + '-' + Math.random().toString(36).slice(2),
    type: 'TODO',
    content: 'Olahraga',
    status: 'pending',
    created_at: now.toISOString(),
    meta: {
      tags: ['routine'],
      isRoutine: true,
      routineInterval: 'weekly',
      routineDaysOfWeek: [0], // Sunday
      recurrenceDays: 7,
      date: nextSunday.toISOString(),
      priority: 'normal'
    }
  };

  data.items = [newItem, ...items];
  localStorage.setItem('braindump_chat_history', JSON.stringify(data));

  // Trigger app reload
  console.log('✅ Created new weekly routine: "Olahraga" — every Sunday at 7AM');
  console.log('   Next occurrence:', nextSunday.toLocaleString('id-ID'));
  console.log('   Reloading...');
  setTimeout(() => location.reload(), 500);
})();
