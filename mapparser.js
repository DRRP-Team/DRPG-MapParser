/**
 * Copyright (c) 2017-2018 DRRP-Team (PROPHESSOR, UsernameAK)
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

"use strict";

const fs = require("fs");
const ByteTools = require("./ByteTools");

const THINGS = require("./things");
const DECALS = require("./decals");

const Config = {
    "width": 768,
    "height": 768
};
const mh = [];

class Parser {
    constructor(from, to) {
        this.from = from;
        this.to = to;
    }

    parse() {
        const texmap = this.getMappings();

        const map = this.parseMap(this.from);

        fs.writeFileSync(this.to, this.generate(map.lines, map.count, texmap, map.things, map.decals, map.bspheader));

        this.display(map.lines, map.count, map.things, map.decals);
    }

    getMappings() {
        const mf = fs.readFileSync("mappings.bin");

        // mfh.read(reinterpret_cast<char*>(&mh), sizeof(mh));
        for (let i = 0; i < 4; i++) mh[i] = mf.readUInt32LE(i * 4);

        // mfh.ignore(8 * mh.group1size + 8 * mh.group2size);
        const offset = 16 + (8 * mh[0]) + (8 * mh[1]);

        // texmap = new uint16_t[mh.group3size];
        const texmap = [];

        // mfh.read(reinterpret_cast<char*>(texmap), sizeof(uint16_t) * mh.group3size);
        for (let i = 0; i < mh[2]; i++) {
            texmap.push(mf.readUInt16LE(offset + (i * 2)));
        }

        // delete mf;

        return texmap;
    }

    parseMap(from) {
        this.buffer = fs.readFileSync(from);
        const file = new ByteTools(this.buffer);

        const bspheader = {
            "floorcolor": {
                "b": file.readUInt8(),
                "g": file.readUInt8(),
                "r": file.readUInt8()
            },
            "ceilingcolor": {
                "b": file.readUInt8(),
                "g": file.readUInt8(),
                "r": file.readUInt8()
            },
            "loadingcolor": {
                "b": file.readUInt8(),
                "g": file.readUInt8(),
                "r": file.readUInt8()
            },
            "levelid": file.readUInt8(),
            "playerstart": file.readUInt16LE(),
            "playerrotation": file.readUInt8()
        };

        let count = file.readUInt16LE();

        console.log("Skiping", count, "bsp nodes");

        file.seek(count * 10, "CUR");
        count = file.readUInt16LE();

        console.log("Line segments", count, "at", file.tell());

        const lines = [];
        for (let i = 0; i < count; i++) {
            const line = {
                "x0": file.readUInt8(),
                "y0": file.readUInt8(),
                "x1": file.readUInt8(),
                "y1": file.readUInt8(),
                "walltex": file.readUInt16LE(),
                "flags": file.readUInt16LE()
            };
            lines.push(line);
        }

        const things = this.parseThings(file);

        const decals = this.parseDecals(things);

        return {
            lines,
            count,
            things,
            decals,
            bspheader
        };
    }

    parseThings(file = new ByteTools()) {
        const count = file.readUInt16LE();

        const things = [];
        for (let i = 0; i < count; i++) {
            const thing = {
                "x": file.readUInt8(),
                "y": file.readUInt8(),
                "id": file.readUInt8(),
                "flags": file.readUInt16LE()
            };

            things.push(thing);
        }
        return things;
    }

    parseDecals(things) {
        const decals = [];
        for (const thing of things) {
            if (!DECALS[thing.id.toString()]) continue;

            const isNotFence = (thing.flags & 2050) ? 0 : 1;
            let x0, y0, x1, y1;
            if (thing.flags & 32) { // east
                x0 = (thing.x * 8 + isNotFence);
                x0 = (thing.x * 8 + isNotFence);
                y0 = (thing.y * 8 + 32);
                y0 = (thing.y * 8 + 32);
                x1 = (thing.x * 8 + isNotFence);
                x1 = (thing.x * 8 + isNotFence);
                y1 = (thing.y * 8 - 32);
                y1 = (thing.y * 8 - 32);
            } else if (thing.flags & 64) { // west
                x0 = (thing.x * 8 - isNotFence);
                x0 = (thing.x * 8 - isNotFence);
                y0 = (thing.y * 8 - 32);
                y0 = (thing.y * 8 - 32);
                x1 = (thing.x * 8 - isNotFence);
                x1 = (thing.x * 8 - isNotFence);
                y1 = (thing.y * 8 + 32);
                y1 = (thing.y * 8 + 32);
            } else if (thing.flags & 16) { // south
                x0 = (thing.x * 8 - 32);
                x0 = (thing.x * 8 - 32);
                y0 = (thing.y * 8 + isNotFence);
                y0 = (thing.y * 8 + isNotFence);
                x1 = (thing.x * 8 + 32);
                x1 = (thing.x * 8 + 32);
                y1 = (thing.y * 8 + isNotFence);
                y1 = (thing.y * 8 + isNotFence);
            } else if (thing.flags & 8) { // north
                x0 = (thing.x * 8 + 32);
                x0 = (thing.x * 8 + 32);
                y0 = (thing.y * 8 - isNotFence);
                y0 = (thing.y * 8 - isNotFence);
                x1 = (thing.x * 8 - 32);
                x1 = (thing.x * 8 - 32);
                y1 = (thing.y * 8 - isNotFence);
                y1 = (thing.y * 8 - isNotFence);
            }

            decals.push({
                "id": thing.id,
                "texture": DECALS[thing.id],
                x0,
                y0,
                x1,
                y1
            });
        }
        return decals;
    }

    generate(lines, count, texmap, things, decals, bspheader) {
        const header = "// Generated by DRRP: MapParser. Created by PROPHESSOR and UsernameAK;\n\nnamespace = \"zdoom\";\n\n";

        let ss = "";
        ss += "sector {\n";
        ss += "\theightceiling = 64;\n";
        ss += "\ttexturefloor = \"floor\";\n";
        ss += "\ttextureceiling = \"ceiling\";\n";
        ss += "}\n\n";

        ss += "thing { // Player Start\n";
        ss += `x=${((bspheader.playerstart % 32) * 64) + 32}.000;`;
        ss += `y=${((32 - Math.floor(bspheader.playerstart / 32)) * 64) - 32}.000;`;
        ss += "type=1;";
        ss += `angle=${90 * bspheader.playerrotation};`;
        ss += "coop=true;";
        ss += "dm=true;";
        ss += "single=true;";
        ss += "skill1=true;";
        ss += "skill2=true;";
        ss += "skill3=true;";
        ss += "skill4=true;";
        ss += "skill5=true;";
        ss += "}";

        let sideid = 0;
        let sectorid = 1;
        const vertices = [];

        function findVertex(x, y) {
            for (let i = 0; i < vertices.length; i++) {
                if (vertices[i][0] == x && vertices[i][1] == y) return i;
            }
            vertices.push([x, y]);
            return vertices.length - 1;
        }

        const isVertical = (x1, x2) => !(x1 - x2);

        // vertexes
        for (let i = 0; i < count; i++) {
            if (texmap[lines[i].walltex] >= 10) {
                const v0 = findVertex(lines[i].x1 * 8, (256 - lines[i].y1) * 8);
                const v1 = findVertex(lines[i].x0 * 8, (256 - lines[i].y0) * 8);

                ss += `sidedef { // ${sideid}\n`;
                ss += "\tsector = 0;\n";
                ss += `\ttexturemiddle = "drdc${texmap[lines[i].walltex]}";\n`;
                ss += "}\n\n";

                ss += "linedef {\n";
                ss += `\tv2 = ${v0};\n`;
                ss += `\tv1 = ${v1};\n`;
                ss += `\tsidefront = ${sideid++};\n`;
                ss += "}\n\n";
            }
        }

        // things
        for (let i = 0; i < things.length; i++) {
            if (things[i].flags & 1) { // Will spawn
                ss += "thing {\n";
                ss += `\ttype = ${THINGS.mapspot};\n`;
                ss += `\tx = ${things[i].x * 8};\n`;
                ss += `\ty = ${(256 - things[i].y) * 8};\n`;
                ss += `\tid = ${(things[i].x << 5) | things[i].y};\n`;
                ss += `\tcomment = "Will spawn ${things[i].id}";\n`;
            } else if (THINGS[things[i].id.toString()]) {
                ss += "thing {\n";
                ss += `\ttype = ${THINGS[things[i].id.toString()]};\n`;
                ss += `\tx = ${things[i].x * 8};\n`;
                ss += `\ty = ${(256 - things[i].y) * 8};\n`;
            } else {
                ss += "thing {\n";
                ss += `\ttype = ${THINGS.notifier};\n`;
                ss += `\tx = ${things[i].x * 8};\n`;
                ss += `\ty = ${(256 - things[i].y) * 8};\n`;
                ss += `\tcomment = "Unknown thing ${things[i].id}";\n`;
            }

            ss += "\tskill1 = true;\n";
            ss += "\tskill2 = true;\n";
            ss += "\tskill3 = true;\n";
            ss += "\tskill4 = true;\n";
            ss += "\tskill5 = true;\n";
            ss += "\tskill6 = true;\n";
            ss += "\tskill7 = true;\n";
            ss += "\tskill8 = true;\n";
            ss += "\tsingle = true;\n";
            ss += "\tcoop = true;\n";
            ss += "\tdm = true;\n";
            ss += "\tclass1 = true;\n";
            ss += "\tclass2 = true;\n";
            ss += "\tclass3 = true;\n";
            ss += "\tclass4 = true;\n";
            ss += "\tclass5 = true;\n";

            ss += "}\n\n";
        }

        // decals

        for (const decal of decals) {
            const v0 = findVertex(decal.x0, (2048 - decal.y0));
            const v1 = findVertex(decal.x1, (2048 - decal.y1));

            ss += "sidedef {\n";
            ss += "\tsector = 0;\n";
            ss += `\ttexturemiddle = "${DECALS[decal.id]}";\n`;
            ss += "}\n\n";

            ss += "sidedef {\n";
            ss += "\tsector = 0;\n";
            ss += `\ttexturemiddle = "${DECALS[decal.id]}";\n`;
            ss += "}\n\n";

            ss += "linedef {\n";
            ss += `\tv1 = ${v0};\n`;
            ss += `\tv2 = ${v1};\n`;
            ss += `\tsidefront = ${sideid++};\n`;
            ss += `\tsideback = ${sideid++};\n`;
            ss += "\ttwosided = true;\n";
            ss += "\tblocking = true;\n";
            ss += "\timpassable = true;\n";
            ss += "}\n\n";
        }

        // doors
        for (let i = 0; i < count; i++) {
            if (texmap[lines[i].walltex] < 10) {
                let v0, v1, v2, v3;

                if (isVertical(lines[i].x0, lines[i].x1)) {
                    v0 = findVertex((lines[i].x1 * 8) - 8, (256 - lines[i].y1) * 8);
                    v1 = findVertex((lines[i].x0 * 8) - 8, (256 - lines[i].y0) * 8);
                    v2 = findVertex((lines[i].x0 * 8) + 8, (256 - lines[i].y0) * 8);
                    v3 = findVertex((lines[i].x1 * 8) + 8, (256 - lines[i].y1) * 8);
                } else {
                    v0 = findVertex(lines[i].x1 * 8, ((256 - lines[i].y1) * 8) - 8);
                    v1 = findVertex(lines[i].x0 * 8, ((256 - lines[i].y0) * 8) - 8);
                    v2 = findVertex(lines[i].x0 * 8, ((256 - lines[i].y0) * 8) + 8);
                    v3 = findVertex(lines[i].x1 * 8, ((256 - lines[i].y1) * 8) + 8);
                }

                ss += `sidedef { // ${sideid}\n`;
                ss += `\ttexturetop = "drdc${texmap[lines[i].walltex] || 0}";\n`;
                ss += `\tsector = ${sectorid};\n`;
                ss += "}\n\n";

                ss += "linedef {\n";
                ss += `\tv2 = ${v0};\n`;
                ss += `\tv1 = ${v1};\n`;
                ss += `\tsidefront = ${sideid++};\n`;
                ss += "\tplayeruse = true;\n";
                ss += "\trepeatspecial = true;\n";
                ss += "\tspecial = 80;\n";
                ss += "\targ0 = 3002;\n";
                ss += "\tcomment = \"door\";\n";
                ss += "}\n\n";

                ss += `sidedef { // ${sideid}\n`;
                ss += `\ttexturetop = "drdc${texmap[lines[i].walltex] || 0}";\n`;
                ss += `\tsector = ${sectorid};\n`;
                ss += "\tscalex_mid = -1;\n";
                ss += "\tscalex_top = -1;\n";
                ss += "}\n\n";


                ss += "linedef {\n";
                ss += `\tv2 = ${v2};\n`;
                ss += `\tv1 = ${v3};\n`;
                ss += `\tsidefront = ${sideid++};\n`;
                ss += "\tplayeruse = true;\n";
                ss += "\trepeatspecial = true;\n";
                ss += "\tspecial = 80;\n";
                ss += "\targ0 = 3002;\n";
                ss += "\tcomment = \"door\";\n";
                ss += "}\n\n";

                ss += `sidedef { // ${sideid}\n`;
                ss += `\ttexturemiddle = "drdc10";\n`;
                ss += `\tsector = ${sectorid};\n`;
                ss += "}\n\n";


                ss += "linedef {\n";
                ss += `\tv2 = ${v0};\n`;
                ss += `\tv1 = ${v3};\n`;
                ss += `\tsidefront = ${sideid++};\n`;
                ss += "}\n\n";

                ss += `sidedef { // ${sideid}\n`;
                ss += `\ttexturemiddle = "drdc10";\n`;
                ss += `\tsector = ${sectorid};\n`;
                ss += "\tscalex_top = -1;\n";
                ss += "}\n\n";

                ss += "linedef {\n";
                ss += `\tv2 = ${v1};\n`;
                ss += `\tv1 = ${v2};\n`;
                ss += `\tsidefront = ${sideid++};\n`;
                ss += "\tcomment = \"door side\";\n";
                ss += "}\n\n";

                ss += `sector { // ${sectorid++}\n`;
                ss += "\theightceiling = 0;\n"; // FIXME: Some sectors extends this height... I don't know why. You have to fix them manually
                ss += "\ttexturefloor = \"drdc10\";\n";
                ss += "\ttextureceiling = \"FLAT20\";\n";
                ss += "}\n\n";
            }
        }

        let vs = "";
        for (const vertex of vertices) {
            vs += "vertex {\n";
            vs += `\tx = ${vertex[0]};\n`;
            vs += `\ty = ${vertex[1]};\n`;
            vs += "}\n\n";
        }

        return header + vs + ss;
    }

    display(lines, count, things, decals) {
        if (!a) return;
        const ctx = document.getElementsByTagName("canvas")[0].getContext("2d");

        function setColor(color) {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
        }

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        function drawLine(x, y, x1, y1) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x1, y1);
            ctx.stroke();
            ctx.closePath();
        }

        function drawCircle(x, y, id) {
            setColor("darkgreen");
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.closePath();
            setColor("pink");
            ctx.fillText(id, x, y);
        }

        ctx.font = "8px sans-serif";

        setColor("black");

        ctx.fillRect(0, 0, innerWidth, innerHeight);

        setColor("red");

        for (let i = 0; i < count; i++) {
            drawLine(lines[i].x0 * 3, lines[i].y0 * 3, lines[i].x1 * 3, lines[i].y1 * 3);
        }

        // setColor("green");

        for (let i = 0; i < things.length; i++) {
            drawCircle(things[i].x * 3, things[i].y * 3, things[i].id);
            drawCircle(things[i].x * 3, things[i].y * 3, things[i].id);
        }

        setColor("cyan");
        for (const decal of decals) {
            drawLine(decal.x0 / (2048 / Config.width), decal.y0 / (2048 / Config.height), decal.x1 / (2048 / Config.width), decal.y1 / (2048 / Config.height));
            // drawCircle(decal.x0*3,768-decal.y0*3,"X");
            // drawCircle(decal.x1*3,768-decal.y1*3,"X");
        }
    }
}

function main(from, to) {
    const parser = new Parser(from, to);

    parser.parse();
}

let a = null;

try {
    a = require("nw.gui").Window.get();
    a.width = Config.width;
    a.height = Config.height;

    // main(process.argv[2] || "level03.bsp", process.argv[3] || "out.tm");
    {
        const from = prompt("Введите полное имя .bsp файла");
        if (from) main(from, `${from}.ts`);
    }
    document.addEventListener("click", () => {
        const from = prompt("Введите полное имя .bsp файла");
        if (from) main(from, `${from}.ts`);
    });
} catch (e) {
    console.log("# === DRRP: MapParser === #");

    const args = process.argv;

    if (args.length != 3) {
        console.info("Usage: <path/to/file.bsp>");
        return 1;
    }

    main(args[2], `${args[2]}.TEXTMAP`);
}
