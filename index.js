import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const CRC_TABLE = (() => {
    const t = new Uint32Array(256)
    for (let i = 0; i < 256; i++) {
        let c = i
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
        t[i] = c
    }
    return t
})()

function crc32(buf) {
    let c = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF]
    return (c ^ 0xFFFFFFFF) >>> 0
}

function walkDir(dir, base) {
    const entries = []
    for (const name of readdirSync(dir)) {
        const fullPath = join(dir, name)
        if (statSync(fullPath).isDirectory()) {
            entries.push(...walkDir(fullPath, base))
        } else {
            entries.push({ fullPath, zipPath: relative(base, fullPath).replace(/\\/g, '/') })
        }
    }
    return entries
}

function zipDir(sourceDir, destFile) {
    const absDestFile = resolve(destFile)
    const files = walkDir(sourceDir, sourceDir).filter(f => resolve(f.fullPath) !== absDestFile)
    const parts = []
    const centralDir = []
    let offset = 0

    for (const { fullPath, zipPath } of files) {
        const raw = readFileSync(fullPath)
        const deflated = deflateRawSync(raw)
        const useDeflate = deflated.length < raw.length
        const compData = useDeflate ? deflated : raw
        const method = useDeflate ? 8 : 0
        const crc = crc32(raw)
        const nameBytes = Buffer.from(zipPath, 'utf-8')

        const local = Buffer.alloc(30 + nameBytes.length)
        local.writeUInt32LE(0x04034b50, 0)
        local.writeUInt16LE(20, 4)
        local.writeUInt16LE(0, 6)
        local.writeUInt16LE(method, 8)
        local.writeUInt16LE(0, 10)
        local.writeUInt16LE(0, 12)
        local.writeUInt32LE(crc, 14)
        local.writeUInt32LE(compData.length, 18)
        local.writeUInt32LE(raw.length, 22)
        local.writeUInt16LE(nameBytes.length, 26)
        local.writeUInt16LE(0, 28)
        nameBytes.copy(local, 30)

        const cd = Buffer.alloc(46 + nameBytes.length)
        cd.writeUInt32LE(0x02014b50, 0)
        cd.writeUInt16LE(20, 4)
        cd.writeUInt16LE(20, 6)
        cd.writeUInt16LE(0, 8)
        cd.writeUInt16LE(method, 10)
        cd.writeUInt16LE(0, 12)
        cd.writeUInt16LE(0, 14)
        cd.writeUInt32LE(crc, 16)
        cd.writeUInt32LE(compData.length, 20)
        cd.writeUInt32LE(raw.length, 24)
        cd.writeUInt16LE(nameBytes.length, 28)
        cd.writeUInt16LE(0, 30)
        cd.writeUInt16LE(0, 32)
        cd.writeUInt16LE(0, 34)
        cd.writeUInt16LE(0, 36)
        cd.writeUInt32LE(0, 38)
        cd.writeUInt32LE(offset, 42)
        nameBytes.copy(cd, 46)

        parts.push(local, compData)
        centralDir.push(cd)
        offset += local.length + compData.length
    }

    const cdBuf = Buffer.concat(centralDir)
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(0, 4)
    eocd.writeUInt16LE(0, 6)
    eocd.writeUInt16LE(files.length, 8)
    eocd.writeUInt16LE(files.length, 10)
    eocd.writeUInt32LE(cdBuf.length, 12)
    eocd.writeUInt32LE(offset, 16)
    eocd.writeUInt16LE(0, 20)

    mkdirSync(dirname(absDestFile), { recursive: true })
    writeFileSync(absDestFile, Buffer.concat([...parts, cdBuf, eocd]))
}

export default function zipBuildPlugin(zipName, options = {}) {
    const { outDir = 'dist', timestamp = true } = options
    return {
        name: 'vite-plugin-zip-build',
        apply: 'build',
        enforce: 'post',
        closeBundle() {
            const now = new Date()
            const pad = n => String(n).padStart(2, '0')
            const ts = timestamp
                ? `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`
                : ''
            const outFile = join(outDir, `${zipName}${ts}.zip`)
            zipDir(outDir, outFile)
            console.log(`\x1b[36m✓ Zip created: ${outFile}\x1b[0m`)
        }
    }
}