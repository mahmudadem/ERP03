import * as admin from 'firebase-admin';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

if (!admin.apps.length) {
    admin.initializeApp({ projectId: 'erp-03' });
}

async function updatePassword() {
    const authUser = await admin.auth().getUserByEmail('sa@test.com');
    await admin.auth().updateUser(authUser.uid, { password: 'password123' });
    console.log('Password updated successfully');
}

updatePassword().then(() => process.exit(0)).catch(e => console.error(e));
