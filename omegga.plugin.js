class BuildingCircle {
  constructor(omegga, config, store) {
    this.omegga = omegga;
    this.config = config;
    this.store = store;
  }

  async init() {
    this.omegga
      .on('cmd:circle', this.circle)

    return {
      registeredCommands: ['circle']
    };
  }

  unauthorized(senderName) {
    const player = this.omegga.getPlayer(senderName);
    if (
      this.config['only-authorized'] && !player.isHost() &&
      !this.config['authorized-users'].some(p => {
        return player.id === p.id
      })
    ) {
      this.omegga.whisper(senderName, '<color="ff0000">Unauthorized to use command.</>');
      return true;
    }
    return false;
  }

  // Fill holes for non-concave shapes
  optimize(bricks, fill, brickGenerated) {
    function combineBricks(first, last) {
      // same brick
      if (first.position[0] === last.position[0] && first.position[1] === last.position[1]) {
        return first
      }
      const { center, minBound, maxBound } = global.OMEGGA_UTIL.brick.getBounds({ brick_assets: [brickGenerated.type], bricks: [first, last] });
      const size = [Math.abs(minBound[0]-maxBound[0])/2, Math.abs(minBound[1]-maxBound[1])/2, Math.abs(minBound[2]-maxBound[2])/2]
      return {
        ...first,
        position: center,
        size
      }
    }

    function optimizeDirection(bricks, primary, secondary) {
      const newBricks = [];
      const sort = bricks.sort((left, right) => left.position[secondary] - right.position[secondary] || left.position[primary] - right.position[primary]);
      let first = sort[0];
      let last = sort[0];
      for (let i = 1; i < sort.length; i++) {
        const current = sort[i];
        if (
          first.size[secondary] === current.size[secondary] &&
          first.position[secondary] === current.position[secondary]
        ) {
          if (fill || (last.position[primary] + last.size[primary]) === (current.position[primary] - current.size[primary])) {
            last = current;
          } else {
            newBricks.push(combineBricks(first, last));
            first = current;
            last = current;
          }
        } else {
          newBricks.push(combineBricks(first, last));
          first = current;
          last = current;
        }
      }
      newBricks.push(combineBricks(first, last));

      return newBricks;
    }

    return optimizeDirection(optimizeDirection(bricks, 0, 1), 1, 0);
  }

  generateCircle(radius, color, fill, brickGenerated) {
    const bricks = [];

    function addBrick(x, y) {
      if (Object.is(x, -0) || Object.is(y, -0))
        return;
      bricks.push({
        color,
        owner_index: 0,
        size: brickGenerated.size,
        position: [ x*brickGenerated.size[0]*2, y*brickGenerated.size[1]*2, brickGenerated.size[2]*2],
        material_index: 0,
        direction: 4,
        rotation: 0
      })
    }

    let f = 1- radius;
    let ddF_x = 0;
    let ddF_y = -2 * radius;
    let x = 0;
    let y = radius;

    addBrick(0, radius)
    addBrick(0, -radius)
    addBrick(radius, 0)
    addBrick(-radius, 0)

    while(x < y) {
      if (f >= 0) {
        y--;
        ddF_y += 2;
        f += ddF_y;
      }
      x++;
      ddF_x += 2;
      f += ddF_x + 1;

      if (y<x) {
        break;
      }

      addBrick(x, y);
      addBrick(-x, y);
      addBrick(x, -y);
      addBrick(-x, -y);

      if (x != y) {
        addBrick(y, x);
        addBrick(-y, x);
        addBrick(y, -x);
        addBrick(-y, -x);
      }
    }

    return this.optimize(bricks, fill, brickGenerated);
  }

  circle = async (senderName, radius, fill = 0) => {
    if(this.unauthorized(senderName)) return;
    if (radius) {
      const player = this.omegga.getPlayer(senderName);
      const nameColor = player.getNameColor();
      this.omegga.broadcast(`<b><color="${nameColor}">${senderName}</></> creating circle with radius ${radius}...`);
      const paint = await player.getPaint();
      const brickGenerated = await this.getGeneratedGhostBrick(player);

      if (!paint) {
        this.omegga.whisper(senderName, 'Select a paint color.');
        return;
      }
      if (!brickGenerated) {
        this.omegga.whisper(senderName, 'Missing ghost brick.');
        return;
      }

      let saveData = {
        version: 10,
        materials: [paint.material],
        brick_assets: [brickGenerated.type],
        bricks: this.generateCircle(radius, paint.color, +fill, brickGenerated)
      };
      await player.loadSaveData(saveData);
    } else {
      this.omegga.whisper(senderName, 'Must enter a radius');
    }
  }

  // getall BrickGridPreviewActor SimpleParameters
  // [2021.04.12-03.29.40:573][579]0) BrickGridPreviewActor /Game/Maps/Plate/Plate.Plate:PersistentLevel.BrickGridPreviewActor_2147482489.SimpleParameters = (BrickType=(BrickType=BrickTypeGenerated'"/Game/Bricks/Procedural/PB_DefaultBrick.PB_DefaultBrick:BrickTypeGenerated_2147482394"'),BrickColor=(B=255,G=255,R=255,A=255),MaterialAlpha=5,PreviewIgnoredBricks=)

  // GetAll BrickTypeGenerated HalfSize
  // [2021.04.12-03.51.37:292][ 65]0) BrickTypeGenerated /Game/Bricks/Procedural/PB_DefaultBrick.PB_DefaultBrick:BrickTypeGenerated_2147482394.HalfSize = (X=5,Y=5,Z=12)
  async getGeneratedGhostBrick({controller}) {
    const ownerRegExp = /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.Owner = BP_PlayerController_C'(.+):PersistentLevel\.(?<controller>BP_PlayerController_C_\d+)'$/;
    const simpleParamsRegExp = /^(?<index>\d+)\) BrickGridPreviewActor (.+):PersistentLevel\.(?<actor>BrickGridPreviewActor_\d+)\.SimpleParameters = \(BrickType=\(.*(\.(?<brickType>.+):(?<brickTypeGenerated>.+)"'|None)\),BrickColor=\(B=(?<b>\d*),G=(?<g>\d*),R=(?<r>\d*),A=(?<a>\d*)\),PreviewIgnoredBricks=.*\)$/;
    const brickSizeRegExp = /^(?<index>\d+)\) BrickTypeGenerated .+:(?<actor>BrickTypeGenerated_\d+)\.HalfSize = \(X=(?<x>\d*),Y=(?<y>\d*),Z=(?<z>\d*)*\)$/;

    const [ownersMatch, simpleParametersMatch] = await Promise.all([
      this.omegga.watchLogChunk('GetAll BrickGridPreviewActor Owner', ownerRegExp, {first: 'index', timeoutDelay: 500}),
      this.omegga.watchLogChunk('GetAll BrickGridPreviewActor SimpleParameters', simpleParamsRegExp, {first: 'index', timeoutDelay: 500}),
    ]);


    // get BrickGridPreviewActor by controller
    const owner = ownersMatch.find((owner) => owner.groups.controller === controller);

    if (!owner)
      return;

    const actor = owner.groups.actor;
    // get transform parameters for the found actor
    const simpleParameters = simpleParametersMatch.find((simpleParameters) => simpleParameters.groups.actor === actor);

    if (!simpleParameters)
      return;

    const { brickType, brickTypeGenerated } = simpleParameters.groups;

    const brickSizeMatch = await this.omegga.watchLogChunk(`GetAll BrickTypeGenerated HalfSize Name=${brickTypeGenerated}`, brickSizeRegExp, {first: 'index', timeoutDelay: 500})

    if (!brickSizeMatch || brickSizeMatch.length === 0)
      return;

    const brickSize = [+brickSizeMatch[0].groups.x, +brickSizeMatch[0].groups.y, +brickSizeMatch[0].groups.z];


    return { type: brickType, size: brickSize }
  }


  stop() {
    this.omegga
      .removeAllListeners('cmd:circle');
  }
}

module.exports = BuildingCircle;