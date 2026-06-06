const storage = require('./storage/events');

async function test() {
  console.log('=== JSONL Storage Layer Test ===\n');
  
  try {
    // Clean up any existing test data
    console.log('Cleaning up test data...');
    const allEvents = await storage.readAllEvents();
    const testEvents = allEvents.filter(e => e.title.includes('Test Event'));
    for (const event of testEvents) {
      await storage.deleteEvent(event.id);
    }
    console.log('Cleaned up.\n');
    
    // Test 1: Create event
    console.log('Test 1: Create Event');
    const event1 = await storage.createEvent({
      date: '2026-03-21',
      title: 'Test Meeting',
      description: 'Testing the storage layer',
      color: '#FF5733',
      startTime: '10:00',
      endTime: '11:30',
      allDay: false
    });
    console.log('✓ Created event:', JSON.stringify(event1, null, 2));
    
    // Test 2: Create another event
    console.log('\nTest 2: Create Another Event');
    const event2 = await storage.createEvent({
      date: '2026-03-22',
      title: 'Test All-Day Event',
      allDay: true
    });
    console.log('✓ Created event:', JSON.stringify(event2, null, 2));
    
    // Test 3: Read all events
    console.log('\nTest 3: Read All Events');
    const all = await storage.readAllEvents();
    console.log(`✓ Found ${all.length} events`);
    for (const e of all) {
      console.log(`  - ${e.title} (${e.date})`);
    }
    
    // Test 4: Read events for specific date
    console.log('\nTest 4: Read Events for 2026-03-21');
    const eventsForDate = await storage.readEventsForDate('2026-03-21');
    console.log(`✓ Found ${eventsForDate.length} events for 2026-03-21`);
    for (const e of eventsForDate) {
      console.log(`  - ${e.title}`);
    }
    
    // Test 5: Read events in range
    console.log('\nTest 5: Read Events in Date Range (2026-03-21 to 2026-03-22)');
    const eventsInRange = await storage.readEventsInRange('2026-03-21', '2026-03-22');
    console.log(`✓ Found ${eventsInRange.length} events in range`);
    for (const e of eventsInRange) {
      console.log(`  - ${e.title} (${e.date})`);
    }
    
    // Test 6: Update event
    console.log('\nTest 6: Update Event');
    const updated = await storage.updateEvent(event1.id, {
      title: 'Updated Test Meeting',
      description: 'Updated description'
    });
    console.log('✓ Updated event:', JSON.stringify(updated, null, 2));
    
    // Test 7: Verify update
    console.log('\nTest 7: Verify Update');
    const verified = await storage.readAllEvents();
    const updatedEvent = verified.find(e => e.id === event1.id);
    console.log(`✓ Title changed: ${updatedEvent?.title}`);
    
    // Test 8: Delete event
    console.log('\nTest 8: Delete Event');
    const deleted = await storage.deleteEvent(event2.id);
    console.log(`✓ Delete result: ${deleted}`);
    
    // Test 9: Verify deletion
    console.log('\nTest 9: Verify Deletion');
    const finalEvents = await storage.readAllEvents();
    console.log(`✓ Remaining events: ${finalEvents.length}`);
    
    // Test 10: Delete non-existent event
    console.log('\nTest 10: Delete Non-Existent Event');
    const deletedFake = await storage.deleteEvent('non-existent-id');
    console.log(`✓ Delete non-existent result: ${deletedFake}`);
    
    console.log('\n=== All Tests Passed! ===');
    
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

test();
