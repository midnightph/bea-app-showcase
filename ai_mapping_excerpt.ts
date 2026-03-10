// ============================================================
// Ai.tsx — Selected excerpts from BEA (Beauty Easy App)
// Full codebase is private for business reasons.
// ============================================================

// --- Daily usage limiter for AI feature (4 uses/day per user) ---
async function updateAiUses(): Promise<boolean> {
  if (!user) return false;
  const userDocRef = doc(database, 'user', user.uid);
  const docSnap = await getDoc(userDocRef);
  const todayStr = new Date().toISOString().split('T')[0];

  if (!docSnap.exists()) {
    await updateDoc(userDocRef, { IA: [{ date: todayStr, uses: 1 }] });
    return true;
  }

  const IAArray = docSnap.data()?.IA || [];
  const todayEntry = IAArray.find((e: any) => e.date === todayStr);

  if (!todayEntry) {
    await updateDoc(userDocRef, { IA: [{ date: todayStr, uses: 1 }] });
    return true;
  }
  if (todayEntry.uses >= 4) return false;

  await updateDoc(userDocRef, {
    IA: [...IAArray.filter((e: any) => e.date !== todayStr), { date: todayStr, uses: todayEntry.uses + 1 }],
  });
  return true;
}

// --- Send image to lash mapping API (Cloud Run endpoint) ---
async function sendImage(uri: string) {
  setLoading(true);

  const formData = new FormData();
  formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' } as any);

  try {
    const canUse = await updateAiUses();
    if (!canUse) {
      Toast.show({ type: 'error', text1: 'Limite diário atingido!', position: 'bottom' });
      return;
    }

    const res = await fetch('https://lash-mapping-326380062160.us-central1.run.app/detect', {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();

    if (json.error) {
      setMappingArray([{ recomendacao: json.error }]);
    } else {
      setMappingArray(Array.isArray(json.mapping) ? json.mapping : null);
      setProcessedImageUrl(json.imageUrl);
    }
  } catch {
    setMappingArray([{ recomendacao: 'Erro ao conectar com o servidor.' }]);
  }
  setLoading(false);
}

// --- Nail AI: fetch random design image from Firebase Storage by color + shape ---
const processImage = async () => {
  if (!cor || !formato) return;

  const folderRef = ref(storage, `iaUnha/${formato}/${cor}`);
  const listResult = await listAll(folderRef);

  if (!listResult.items.length) {
    Toast.show({ type: 'info', text1: 'Nenhuma imagem encontrada para esta combinação' });
    return;
  }

  const urls = await Promise.all(listResult.items.map(item => getDownloadURL(item)));
  const randomUrl = urls[Math.floor(Math.random() * urls.length)];
  setRandomImage(randomUrl);
};
