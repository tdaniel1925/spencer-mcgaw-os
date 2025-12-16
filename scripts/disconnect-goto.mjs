// Disconnect GoTo Connect integration

async function disconnectGoTo() {
  try {
    const response = await fetch('https://spencer-mcgaw-os.vercel.app/api/integrations/goto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disconnect' })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.authUrl) {
      console.log('\n📱 To reconnect, go to:');
      console.log(data.authUrl);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

disconnectGoTo();
