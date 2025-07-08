#!/usr/bin/env node

// 📋 SCRIPT DE PRUEBA PARA ENDPOINTS DE DOCUMENTOS
// Este script te ayudará a probar los endpoints con diferentes tokens

const API_BASE_URL = 'http://localhost:3001';

// 🔑 Función para hacer requests con token
async function makeRequest(endpoint, token, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const options = {
    method,
    headers,
    ...(body && { body: JSON.stringify(body) })
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    return {
      status: response.status,
      success: response.ok,
      data
    };
  } catch (error) {
    return {
      status: 500,
      success: false,
      error: error.message
    };
  }
}

// 📝 Función para probar todos los endpoints
async function testDocumentEndpoints(token) {
  console.log('🔍 Probando endpoints de documentos...\n');
  
  // 1. Obtener todos los documentos
  console.log('1. GET /documentos');
  const allDocs = await makeRequest('/documentos', token);
  console.log(`Status: ${allDocs.status}`);
  console.log(`Documentos encontrados: ${allDocs.data?.length || 0}`);
  console.log('Data:', JSON.stringify(allDocs.data, null, 2));
  console.log('\n---\n');
  
  // 2. Obtener MIS documentos
  console.log('2. GET /documentos/my-documents');
  const myDocs = await makeRequest('/documentos/my-documents', token);
  console.log(`Status: ${myDocs.status}`);
  console.log(`Mis documentos: ${myDocs.data?.length || 0}`);
  console.log('Data:', JSON.stringify(myDocs.data, null, 2));
  console.log('\n---\n');
  
  // 3. Si hay documentos, obtener uno específico
  if (allDocs.data && allDocs.data.length > 0) {
    const docId = allDocs.data[0].id;
    console.log(`3. GET /documentos/${docId}`);
    const oneDoc = await makeRequest(`/documentos/${docId}`, token);
    console.log(`Status: ${oneDoc.status}`);
    console.log('Data:', JSON.stringify(oneDoc.data, null, 2));
  }
}

// 🚀 Función principal
async function main() {
  console.log('🛠️ HERRAMIENTA DE PRUEBA DE DOCUMENTOS\n');
  
  // Aquí debes poner tu token JWT real
  const YOUR_TOKEN = 'TU_TOKEN_JWT_AQUI';
  
  if (YOUR_TOKEN === 'TU_TOKEN_JWT_AQUI') {
    console.log('❌ ERROR: Debes reemplazar YOUR_TOKEN con tu token JWT real');
    console.log('💡 Obtén tu token desde:');
    console.log('   - El localStorage del navegador');
    console.log('   - O desde el response de login');
    console.log('   - O desde las developer tools');
    return;
  }
  
  await testDocumentEndpoints(YOUR_TOKEN);
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { makeRequest, testDocumentEndpoints };
