const axios = require('axios');

async function testComprehensiveEndpoint() {
  try {
    console.log('First, checking available routes...');
    
    const debugResponse = await axios.get('http://localhost:5000/api/roadmap/debug-routes', {
      timeout: 5000
    });
    
    console.log('Available routes:', JSON.stringify(debugResponse.data, null, 2));
    
    console.log('\nNow testing /api/roadmap/generate-comprehensive endpoint...');
    
    const response = await axios.post('http://localhost:5000/api/roadmap/generate-comprehensive', {
      provider: 'ollama'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      },
      timeout: 10000
    });
    
    console.log('✅ Success! Status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error Response Status:', error.response.status);
      console.log('Error Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log('❌ No response received:', error.message);
    } else {
      console.log('❌ Request setup error:', error.message);
    }
  }
}

testComprehensiveEndpoint();