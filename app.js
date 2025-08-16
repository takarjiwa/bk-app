// --- Global State ---
let currentSessionId = null;
let currentUserName = "Pengguna Anonim";
let currentEthnicGroup = "Umum";
let currentEducationLevel = "Umum";
let sessionSummary = []; // Still used for live session summary
let lastActiveContentSection = "content-1";

// --- Core Functions ---

/**
 * Creates a new user session by calling the backend.
 * @param {string} userName - The user's name.
 * @param {string} ethnicGroup - The user's selected ethnic group.
 * @param {string} educationLevel - The user's selected education level.
 * @returns {Promise<number|null>} The new session ID or null on failure.
 */
async function createNewSession(userName, ethnicGroup, educationLevel) {
  try {
    const response = await fetch(`/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName, ethnicGroup, educationLevel }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }
    const data = await response.json();
    return data.sessionId;
  } catch (error) {
    console.error("Failed to create session:", error);
    document.getElementById("welcome-error").innerText =
      "Gagal memulai sesi. Pastikan server backend berjalan.";
    document.getElementById("welcome-error").classList.remove("hidden");
    return null;
  }
}

/**
 * Saves a user's interaction with the AI to the backend.
 * @param {string} featureTitle - The name of the feature used.
 * @param {string} userInput - The text the user entered.
 * @param {string} aiOutput - The response from the AI.
 */
async function saveInteraction(featureTitle, userInput, aiOutput) {
  if (!currentSessionId) {
    console.error("Cannot save interaction without a session ID.");
    return;
  }
  try {
    await fetch(`/api/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: currentSessionId,
        featureTitle: featureTitle,
        userInput: userInput,
        aiOutput: aiOutput,
      }),
    });
  } catch (error) {
    console.error("Failed to save interaction:", error);
    // Optionally, display a non-blocking error to the user
  }
}

/**
 * Calls the Gemini API and saves the interaction to the backend.
 */
async function callGeminiAPI(
  prompt,
  outputElement,
  loadingElement,
  featureTitle,
  inputValue
) {
  outputElement.innerHTML = "";
  loadingElement.classList.remove("hidden");

  // The new URL points to our own secure endpoint
  const apiUrl = `/api/gemini`;

  try {
    // The payload only needs the prompt, the API key is handled by the server
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt }), // Send only the prompt
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();
    // The rest of the function remains the same, as our serverless function
    // returns the same structure as the original Gemini API.
    if (
      result.candidates &&
      result.candidates.length > 0 &&
      result.candidates[0].content &&
      result.candidates[0].content.parts &&
      result.candidates[0].content.parts.length > 0
    ) {
      const text = result.candidates[0].content.parts[0].text;
      let cleanedText = text
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*/g, "")
        .replace(/###\s*/g, "");
      outputElement.innerHTML = cleanedText.replace(/\n/g, "<br>");

      sessionSummary.push({
        feature: featureTitle,
        input: inputValue,
        output: cleanedText,
      });

      await saveInteraction(featureTitle, inputValue, cleanedText);
    } else {
      outputElement.innerHTML =
        '<p class="text-red-500">Maaf, tidak dapat menghasilkan respons. Coba lagi.</p>';
    }
  } catch (error) {
    outputElement.innerHTML = `<p class="text-red-500">Terjadi kesalahan: ${error.message}. Coba lagi.</p>`;
  } finally {
    loadingElement.classList.add("hidden");
  }
}

/**
 * Synthesizes the summary from the local sessionSummary array.
 */
/**
 * Synthesizes the summary by calling the secure backend endpoint.
 */
async function renderSynthesizedSummary() {
  const sessionSummaryDisplay = document.getElementById(
    "sessionSummaryDisplay"
  );
  const summaryLoading = document.getElementById("summaryLoading");

  if (sessionSummary.length === 0) {
    sessionSummaryDisplay.innerHTML =
      '<p class="text-stone-500">Belum ada interaksi dengan AI untuk dirangkum dalam sesi ini.</p>';
    return;
  }

  summaryLoading.classList.remove("hidden");
  sessionSummaryDisplay.innerHTML = "";

  let prompt = `Sebagai seorang konselor yang ramah dan suportif, buatkan ringkasan yang padat dan kesimpulan dari sesi bimbingan konseling untuk siswa bernama ${currentUserName} dengan latar belakang suku ${currentEthnicGroup} dan tingkat pendidikan ${currentEducationLevel}. Ringkasan ini harus menyatukan semua poin dari interaksi berikut dan menyajikannya dalam bentuk narasi yang mengalir, tidak berupa daftar. Tonjolkan kekuatan dan potensi siswa, berikan motivasi, dan berikan panduan akhir. Berikut adalah data interaksi yang perlu Anda sintesis:\n\n`;
  sessionSummary.forEach((item) => {
    prompt += `- ${item.feature}:\n  Input siswa: "${item.input}"\n  Saran AI: "${item.output}"\n\n`;
  });
  prompt += `Susun ringkasan ini dengan bahasa yang hangat, penuh dukungan, dan mudah dipahami oleh remaja.`;

  // THIS IS THE CORRECTED PART
  // It now points to your backend and sends only the prompt.
  const apiUrl = `/api/gemini`;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const result = await response.json();
    if (result.candidates && result.candidates[0].content.parts) {
      const text = result.candidates[0].content.parts[0].text;
      const ethnicInfo =
        currentEthnicGroup !== "Umum" ? ` (Suku: ${currentEthnicGroup})` : "";
      const educationInfo =
        currentEducationLevel !== "Umum"
          ? ` (Tingkat Pendidikan: ${currentEducationLevel})`
          : "";
      const summaryHeader = `<h3 class="font-bold text-xl text-teal-700 mb-4">Ringkasan Sesi Bimbingan untuk ${currentUserName}${ethnicInfo}${educationInfo}</h3><p class="text-sm text-stone-500 mb-6">Tanggal: ${new Date().toLocaleDateString(
        "id-ID"
      )}</p><hr class="mb-6">`;
      sessionSummaryDisplay.innerHTML =
        summaryHeader + text.replace(/\n/g, "<br>");
    } else {
      sessionSummaryDisplay.innerHTML =
        '<p class="text-red-500">Maaf, tidak dapat menyusun ringkasan. Coba lagi.</p>';
    }
  } catch (error) {
    sessionSummaryDisplay.innerHTML = `<p class="text-red-500">Terjadi kesalahan saat menyusun ringkasan: ${error.message}. Coba lagi.</p>`;
  } finally {
    summaryLoading.classList.add("hidden");
  }
}

/**
 * Shows a specific content section and hides others.
 * @param {string} targetId - The ID of the section to show.
 */
function showSection(targetId) {
  document
    .querySelectorAll(".content-section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".nav-link")
    .forEach((l) => l.classList.remove("active"));

  const targetSection = document.getElementById(targetId);
  if (targetSection) {
    targetSection.classList.add("active");
    const navId = "nav-" + targetId.split("-")[1];
    const correspondingNavLink = document.getElementById(navId);
    if (correspondingNavLink) {
      correspondingNavLink.classList.add("active");
    }
  }

  if (targetId === "content-7") {
    renderSynthesizedSummary();
  }
}

// --- DOM Event Listeners ---
document.addEventListener("DOMContentLoaded", function () {
  // Element selectors
  const welcomeSection = document.getElementById("welcome-section");
  const appContent = document.getElementById("app-content");
  const enterAppBtn = document.getElementById("enter-app-btn");
  const userNameInput = document.getElementById("userNameInput");
  const ethnicGroupSelect = document.getElementById("ethnicGroupSelect");
  const educationLevelSelect = document.getElementById("educationLevelSelect");
  const userDisplayName = document.getElementById("user-display-name");

  // --- Welcome Screen Logic ---
  enterAppBtn.addEventListener("click", async () => {
    const name = userNameInput.value.trim() || "Pengguna Anonim";
    const ethnicGroup = ethnicGroupSelect.value;
    const educationLevel = educationLevelSelect.value;

    enterAppBtn.disabled = true;
    enterAppBtn.innerText = "Memulai Sesi...";

    const sessionId = await createNewSession(name, ethnicGroup, educationLevel);

    enterAppBtn.disabled = false;
    enterAppBtn.innerText = "Yuk, Masuk ke Aplikasi! 🚀";

    if (sessionId) {
      currentSessionId = sessionId;
      currentUserName = name;
      currentEthnicGroup = ethnicGroup;
      currentEducationLevel = educationLevel;
      userDisplayName.innerText = currentUserName;

      welcomeSection.classList.add("hidden");
      appContent.classList.remove("hidden");
      showSection("content-1");
    }
  });

  // --- Main App Navigation and Actions ---
  document
    .getElementById("back-to-welcome-btn")
    .addEventListener("click", () => {
      if (sessionSummary.length > 0) {
        showSection("content-7");
      } else {
        showSection("content-8");
      }
    });

  document
    .getElementById("proceed-to-support-btn")
    .addEventListener("click", () => {
      showSection("content-8");
    });

  document.getElementById("restart-app-btn").addEventListener("click", () => {
    // Reset state
    sessionSummary = [];
    currentSessionId = null;
    currentUserName = "Pengguna Anonim";
    currentEthnicGroup = "Umum";
    currentEducationLevel = "Umum";

    // Reset UI
    appContent.classList.add("hidden");
    welcomeSection.classList.remove("hidden");
    userNameInput.value = "";
    ethnicGroupSelect.value = "Umum";
    educationLevelSelect.value = "Umum";
    document.getElementById("welcome-error").classList.add("hidden");
    showSection("content-1");
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = "content-" + link.id.split("-")[1];
      showSection(targetId);
    });
  });

  // --- AI Feature Button Listeners ---
  const setupAIButton = (
    buttonId,
    inputId,
    outputId,
    loadingId,
    featureName,
    promptGenerator
  ) => {
    document.getElementById(buttonId).addEventListener("click", () => {
      const inputValue = document.getElementById(inputId).value.trim();
      if (inputValue) {
        const prompt = promptGenerator(inputValue);
        callGeminiAPI(
          prompt,
          document.getElementById(outputId),
          document.getElementById(loadingId),
          featureName,
          inputValue
        );
      } else {
        document.getElementById(
          outputId
        ).innerHTML = `<p class="text-red-500">Mohon isi kolom input terlebih dahulu.</p>`;
      }
    });
  };

  setupAIButton(
    "findStrengthBtn",
    "challengeInput",
    "strengthOutput",
    "strengthLoading",
    "Temuan Kekuatan Diri",
    (val) =>
      `Halo ${currentUserName}! Saya adalah seorang remaja dengan tingkat pendidikan ${currentEducationLevel} yang menghadapi tantangan ini: "${val}". Sebagai konselor psikologi, bantu saya melihat sisi positif dari tantangan ini atau identifikasi kekuatan karakter (misalnya: kemandirian, ketangguhan, empati) yang mungkin saya kembangkan. Berikan respons yang memotivasi. Sertakan juga perspektif tentang resiliensi dari budaya suku ${currentEthnicGroup} jika relevan.`
  );

  setupAIButton(
    "generateProfessionBtn",
    "interestInput",
    "professionOutput",
    "professionLoading",
    "Ide Profesi",
    (val) =>
      `Halo ${currentUserName}! Sebagai konselor karir untuk remaja tingkat ${currentEducationLevel} dari suku ${currentEthnicGroup}, berikan 5-7 ide profesi realistis berdasarkan minat: "${val}". Fokus pada profesi yang bisa dicapai dengan jalur non-tradisional atau biaya rendah.`
  );

  setupAIButton(
    "generateEducationPathBtn",
    "educationPathInput",
    "educationPathOutput",
    "educationPathLoading",
    "Jalur Pendidikan",
    (val) =>
      `Halo ${currentUserName}! Saya remaja tingkat ${currentEducationLevel} dan tertarik pada: "${val}". Sebagai konselor pendidikan, berikan 3-5 jalur pendidikan realistis (SMK, kursus, magang, dll.) untuk mencapai ini, termasuk opsi beasiswa atau biaya rendah.`
  );

  setupAIButton(
    "generateActionPlanBtn",
    "goalInput",
    "actionPlanOutput",
    "actionPlanLoading",
    "Rencana Aksi",
    (val) =>
      `Halo ${currentUserName}! Saya ingin mencapai tujuan ini: "${val}". Sebagai konselor, bantu saya membuat rencana aksi SMART (Specific, Measurable, Achievable, Relevant, Time-bound) yang bisa saya lakukan.`
  );

  setupAIButton(
    "planTalentBtn",
    "talentInput",
    "talentOutput",
    "talentLoading",
    "Rencana Pengembangan Potensi",
    (val) =>
      `Halo ${currentUserName}! Saya punya minat/bakat: "${val}". Sebagai konselor, berikan 3-5 langkah praktis untuk mengembangkannya, termasuk sumber daya gratis atau komunitas online yang bisa saya ikuti.`
  );

  setupAIButton(
    "generateBullyingResponseBtn",
    "bullyingScenarioInput",
    "bullyingResponseOutput",
    "bullyingLoading",
    "Saran Respon Bullying",
    (val) =>
      `Halo ${currentUserName}! Saya menyaksikan atau mengalami situasi ini: "${val}". Sebagai konselor, berikan saran konkret dan aman tentang cara merespons, baik sebagai korban maupun sebagai teman yang melihat (bystander).`
  );

  setupAIButton(
    "generateFeelingsExpressionBtn",
    "expressFeelingsInput",
    "feelingsExpressionOutput",
    "feelingsExpressionLoading",
    "Saran Ungkap Perasaan",
    (val) =>
      `Halo ${currentUserName}! Saya mengalami situasi ini: "${val}". Sebagai konselor, bantu saya merumuskan cara mengungkapkannya menggunakan "I-statements" (kalimat 'saya merasa...') secara konstruktif.`
  );

  setupAIButton(
    "generateCopingStrategyBtn",
    "stressInput",
    "copingStrategyOutput",
    "copingStrategyLoading",
    "Strategi Mengatasi Stres",
    (val) =>
      `Halo ${currentUserName}! Saya stres karena: "${val}". Sebagai konselor psikologi, berikan beberapa strategi coping praktis (misalnya teknik pernapasan, mindfulness, journaling) yang bisa saya lakukan sekarang.`
  );

  // --- Summary Download/Print Logic ---
  document
    .getElementById("summary-download-btn")
    .addEventListener("click", () => {
      const content = document.getElementById(
        "sessionSummaryDisplay"
      ).innerText;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Ringkasan_BK_${currentUserName.replace(
        /\s/g,
        "_"
      )}_${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });

  document.getElementById("summary-print-btn").addEventListener("click", () => {
    const content = document.getElementById("sessionSummaryDisplay").innerHTML;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      `<html><head><title>Ringkasan Bimbingan Konseling</title><style>body{font-family:'Inter',sans-serif;margin:20px;}h3{color:#0f766e;}hr{border:0;border-top:1px solid #eee;margin:20px 0;}</style></head><body>${content}</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });

  // --- Chart Initialization ---
  new Chart(document.getElementById("careerPathChart").getContext("2d"), {
    type: "bar",
    data: {
      labels: [
        "Universitas",
        "Sekolah Vokasi",
        "Kursus Singkat",
        "Magang/Kerja",
      ],
      datasets: [
        {
          label: "Peluang Sukses",
          data: [80, 85, 75, 90],
          backgroundColor: [
            "rgba(15, 118, 110, 0.6)",
            "rgba(13, 148, 136, 0.6)",
            "rgba(45, 212, 191, 0.6)",
            "rgba(20, 184, 166, 0.6)",
          ],
          borderColor: ["#0f766e", "#0d9488", "#2dd4bf", "#14b8a6"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    },
  });

  new Chart(document.getElementById("bullyingImpactChart").getContext("2d"), {
    type: "doughnut",
    data: {
      labels: [
        "Kesehatan Mental",
        "Prestasi Akademik",
        "Hubungan Sosial",
        "Kepercayaan Diri",
      ],
      datasets: [
        {
          label: "Dampak Perundungan",
          data: [40, 25, 20, 15],
          backgroundColor: [
            "rgba(252, 165, 165, 0.7)",
            "rgba(251, 113, 133, 0.7)",
            "rgba(244, 63, 94, 0.7)",
            "rgba(225, 29, 72, 0.7)",
          ],
          borderColor: ["#fca5a5", "#fb7185", "#f43f5e", "#e11d48"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
    },
  });
});
