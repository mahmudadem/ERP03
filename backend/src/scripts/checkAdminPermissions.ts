import { admin } from '../firebaseAdmin';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function checkAdminPermissions() {
    const email = 'admin@demo.com';
    console.log(`Checking permissions for user: ${email}`);

    try {
        const db = admin.firestore();
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        
        const userDoc = await db.collection('users').doc(uid).get();
        const companyId = userDoc.data()?.activeCompanyId;
        console.log(`Active Company: ${companyId}`);
        console.log(`Is System Admin (User Doc): ${userDoc.data()?.isAdmin}`);

        // Check company role
        const membershipSnap = await db.collection('company_users')
            .where('userId', '==', uid)
            .where('companyId', '==', companyId)
            .get();
            
        if (!membershipSnap.empty) {
            const mem = membershipSnap.docs[0].data();
            console.log(`Role ID: ${mem.roleId}`);
            
            const roleDoc = await db.collection('companies').doc(companyId).collection('roles').doc(mem.roleId).get();
            console.log(`Role Name: ${roleDoc.data()?.name}`);
            console.log(`Permissions: ${JSON.stringify(roleDoc.data()?.permissions)}`);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkAdminPermissions().then(() => process.exit());
