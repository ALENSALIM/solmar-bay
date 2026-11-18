// Screenshot staging for Solmar Bay: puts the live game into the four named
// scenes the screenshots show. Every scene is the real game, posed by driving
// its own systems — no fake renders.

export function stageScene(game, name) {
  const L = game.city.landmarks;
  const resetPlayer = () => {
    if (game.player.inCar) game.player.exitCar();
    game.player.health = 100;
    game.police.clearWanted();
  };
  if (name === 'title') {
    resetPlayer();
    game.state = 'title';
    game.hud.showTitle(game.saveData.missionsDone.length > 0);
    game.player.mesh.position.set(0, 0, -120);
    game.player.heading = Math.PI;
    game.player.mesh.rotation.y = Math.PI;
    game.camera.position.set(0, 26, -160);
    game.camera.lookAt(0, 6, 60);
    game.camYaw = 0;
    return true;
  }
  if (name === 'drive') {
    resetPlayer();
    game.state = 'playing';
    game.hud.hideScreens();
    const car = game.fleet.parked[0];
    if (!car) return false;
    game.player.mesh.position.set(car.mesh.position.x, 0, car.mesh.position.z - 4);
    game.player.enterCar(game.fleet.stealParked(car));
    // Put the car in the right lane of the nearest north-south road so the
    // shot shows real street driving, not the sidewalk it was parked on.
    const roads = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
    let best = roads[0];
    for (const r of roads) {
      if (Math.abs(r - game.player.car.mesh.position.x) < Math.abs(best - game.player.car.mesh.position.x)) best = r;
    }
    game.player.car.mesh.position.x = best + 2.6;
    game.player.carSpeed = 24;
    game.player.car.heading = 0;
    game.player.car.mesh.rotation.y = 0;
    game.camYaw = 0;
    game.snapCamera();
    return true;
  }
  if (name === 'chase') {
    resetPlayer();
    game.state = 'playing';
    game.hud.hideScreens();
    const car = game.fleet.parked[1] || game.fleet.parked[0];
    if (!car) return false;
    game.player.mesh.position.set(car.mesh.position.x, 0, car.mesh.position.z - 4);
    game.player.enterCar(game.fleet.stealParked(car));
    const roads = [-176, -132, -88, -44, 0, 44, 88, 132, 176];
    let best = roads[0];
    for (const r of roads) {
      if (Math.abs(r - game.player.car.mesh.position.x) < Math.abs(best - game.player.car.mesh.position.x)) best = r;
    }
    game.player.car.mesh.position.x = best + 2.6;
    game.player.carSpeed = 26;
    game.player.car.heading = 0;
    game.player.car.mesh.rotation.y = 0;
    game.police.setWanted(3);
    // Pursuit cars in the lanes: two ahead in view, one closing from behind.
    const px = game.player.pos.x;
    const pz = game.player.pos.z;
    game.police.spawnPursuitCar(px, pz, px, pz + 18);
    game.police.spawnPursuitCar(px, pz, px - 5.2, pz + 26);
    game.police.spawnPursuitCar(px, pz, px, pz - 14);
    game.camYaw = 0;
    game.snapCamera();
    return true;
  }
  if (name === 'combat') {
    resetPlayer();
    game.state = 'playing';
    game.hud.hideScreens();
    game.missions.start(2);
    game.player.mesh.position.set(L.beach.x, 0, L.beach.z - 18);
    game.player.heading = 0;
    game.player.mesh.rotation.y = 0;
    game.camYaw = 0;
    game.combat.current = 'pistol';
    // Put two of the rival crew close ahead so the shot clearly reads as a
    // firefight instead of an empty beach.
    const foes = game.crowd.livingEnemies();
    const spots = [[-6, 10], [5, 14]];
    for (let i = 0; i < Math.min(2, foes.length); i++) {
      foes[i].mesh.position.set(game.player.pos.x + spots[i][0], 0, game.player.pos.z + spots[i][1]);
    }
    game.snapCamera();
    return true;
  }
  return false;
}
