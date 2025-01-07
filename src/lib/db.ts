import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { SavedTranslation } from '../types/translation';

export async function saveTranslation(userId: string, translation: Omit<SavedTranslation, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, 'translations'), {
      ...translation,
      userId,
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving translation:', error);
    throw error;
  }
}

export async function updateTranslation(translationId: string, translation: Partial<SavedTranslation>) {
  try {
    const docRef = doc(db, 'translations', translationId);
    await updateDoc(docRef, {
      ...translation,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating translation:', error);
    throw error;
  }
}

export async function deleteTranslation(translationId: string) {
  try {
    const docRef = doc(db, 'translations', translationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting translation:', error);
    throw error;
  }
}

export async function getUserTranslations(userId: string) {
  try {
    const q = query(
      collection(db, 'translations'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    }) as SavedTranslation[];
  } catch (error) {
    console.error('Error getting translations:', error);
    throw error;
  }
}

export async function renameTranslation(translationId: string, newTitle: string) {
  try {
    const docRef = doc(db, 'translations', translationId);
    await updateDoc(docRef, {
      title: newTitle,
      timestamp: Timestamp.now()
    });
  } catch (error) {
    console.error('Error renaming translation:', error);
    throw error;
  }
} 