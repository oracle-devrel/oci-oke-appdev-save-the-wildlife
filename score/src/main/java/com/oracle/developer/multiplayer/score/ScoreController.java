package com.oracle.developer.multiplayer.score;

import com.oracle.developer.multiplayer.score.data.Score;
import com.oracle.developer.multiplayer.score.data.ScoreDAO;
import com.oracle.developer.multiplayer.score.data.ScoreRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@RestController
public class ScoreController {
    Logger logger = LoggerFactory.getLogger(ScoreController.class);

    private final ScoreRepository repository;

    public ScoreController(ScoreRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/api/score")
    List<ScoreDAO> getAll() {
        logger.info("GET /api/score");
        List<ScoreDAO> all = new ArrayList<>();
        Sort sortByScore = Sort.by(Sort.Direction.DESC, "score");
        Pageable topResults = PageRequest.of(0,10, sortByScore);
        repository
                .findAll(topResults)
                .forEach(s -> all.add(new ScoreDAO(s.getUuid(),s.getName(), s.getScore() )));
        return all;
    }

    @GetMapping("/api/score/{uuid}")
    ScoreDAO getByUuid(@PathVariable("uuid") String uuid) {
        logger.info("GET /api/score/" + uuid);
        Sort sortByScore = Sort.by(Sort.Direction.DESC, "score");
        Pageable topResults = PageRequest.of(0,10, sortByScore);
        Score score = repository.findByUuid(uuid).orElseThrow(() -> new NotAuthorizedOrNotFound());
        return new ScoreDAO(score.getUuid(),score.getName(), score.getScore() );
    }

    @PutMapping("/api/score/{uuid}")
    ScoreDAO addScore(@PathVariable("uuid") String uuid, @RequestBody ScoreDAO body) {
        logger.info("PUT /api/score/" + uuid);
        Score scoreFromStore = repository.findByUuid(uuid)
                .orElse(new Score());
        if (scoreFromStore.getScore() < body.getScore()) {
            scoreFromStore.setScore(body.getScore());
            scoreFromStore.setName(body.getName());
            scoreFromStore.setUuid(uuid);
            Score saved = repository.save(scoreFromStore);
            return new ScoreDAO(saved.getUuid(),saved.getName(), saved.getScore() );
        }
        throw new NotAuthorizedOrNotFound();
    }

    @DeleteMapping("/api/score")
    ResponseEntity<Void> deleteAll() {
        logger.info("DELETE /api/score");
        repository.deleteAll();
        return new ResponseEntity<Void>(HttpStatus.NO_CONTENT);
    }

}
