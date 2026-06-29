import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, connectAuthEmulator } from "firebase/auth";
import axios from "axios";

// Standard Firebase config doesn't matter much for emulator
const firebaseConfig = {
  apiKey: "AIzaSyCnTt--34iD2DNTkBh80XlIpOuZfRDNI20",
  authDomain: "erp-03.firebaseapp.com",
  projectId: "erp-03",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099");

async function testLogin() {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, "sa@test.com", "password123");
    const token = await userCredential.user.getIdToken(true);
    console.log("Token acquired.");

    const resp = await axios.get("http://127.0.0.1:5001/erp-03/us-central1/api/api/v1/auth/me/permissions", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log("Permissions response:", JSON.stringify(resp.data, null, 2));
  } catch (error: any) {
    console.error("Test failed:", error?.response?.data || error.message);
  }
}

testLogin().then(() => process.exit(0)).catch(() => process.exit(1));
