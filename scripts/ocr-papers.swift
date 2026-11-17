// 扫描 PDF 没有文本层；用本机 Vision 输出带位置和置信度的识别证据，避免依赖在线 OCR。
import Foundation
import Vision
import ImageIO

let arguments = Array(CommandLine.arguments.dropFirst())
let english = arguments.contains("--english")
for path in arguments.filter({ $0 != "--english" }) {
    do {
        let url = URL(fileURLWithPath: path)
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.recognitionLanguages = english ? ["en-US"] : ["zh-Hans", "en-US"]
        request.usesLanguageCorrection = false
        let handler = VNImageRequestHandler(url: url, options: [:])
        try handler.perform([request])
        let lines: [[String: Any]] = (request.results ?? []).compactMap { observation in
            guard let candidate = observation.topCandidates(1).first else { return nil }
            let box = observation.boundingBox
            return ["text": candidate.string, "confidence": candidate.confidence,
                    "x": box.minX, "y": box.minY, "width": box.width, "height": box.height]
        }
        let data = try JSONSerialization.data(withJSONObject: ["path": path, "lines": lines], options: [.sortedKeys])
        print(String(decoding: data, as: UTF8.self))
        fflush(stdout)
    } catch {
        fputs("OCR failed for \(path): \(error)\n", stderr)
        exit(1)
    }
}
