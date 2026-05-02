const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let capturedBlob = null;

// Open rear camera
navigator.mediaDevices.getUserMedia({
    video: {
        facingMode: { exact: "environment" }
    },
    audio: false
})
.then(stream => {
    video.srcObject = stream;
})
.catch(() => {
    // fallback if rear camera fails
    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => video.srcObject = stream);
});



function retake() {
    document.getElementById('video').style.display = 'block';
    document.getElementById('previewContainer').style.display = 'none';
}

function capture() {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    canvas.hidden = false;
// Style alignment: Hide video, show captured preview
    document.getElementById('video').style.display = 'none';
    document.getElementById('previewContainer').style.display = 'block';

    canvas.toBlob(blob => {
        capturedBlob = blob;
        alert("Image captured!");
    }, "image/jpeg", 0.95);
}

function upload() {
    if (!capturedBlob) {
        alert("Capture image first");
        return;
    }

    const formData = new FormData();
    formData.append("file", capturedBlob, "receipt.jpg");

    fetch("/upload-receipt", {
        method: "POST",
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
    })
    .then(data => {
        displayResult(data);
    })
    .catch(err => alert(err.message));
}


function displayResult(data) {

    document.getElementById("resultCard").style.display = "block";
    document.getElementById("merchant").innerText = data.merchant_name|| "N/A";
    document.getElementById("amount").innerText = data.total_amount || "0.00";
    document.getElementById("category").innerText = data.category || "Uncategorized";

    const tbody = document.getElementById("linesTableBody");
    tbody.innerHTML = ""; // clear previous rows

    (data.line_items || []).forEach((line, index) => {
        const row = document.createElement("tr");

        const item_name = document.createElement("td");
        item_name.textContent = line.item_name;

        const item_quantity = document.createElement("td");
        item_quantity.textContent = line.item_quantity;

        const item_price = document.createElement("td");
        item_price.textContent = line.item_price;

        row.appendChild(item_name);
        row.appendChild(item_quantity);
        row.appendChild(item_price)

        tbody.appendChild(row);
    });
}